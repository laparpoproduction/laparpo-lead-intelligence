import { describe, expect, it } from "vitest";
import {
  assertSafePipelineSummaryJsonStructure,
  parseRawPipelineSummaryJson,
  pipelineSummarySchema,
  UnsafePipelineSummaryStructureError,
} from "./opportunity-pipeline-summary.schema";
import { projectOpportunityPipelineSummary } from "./opportunity-pipeline-summary.projection";
import { OpportunityPipelineSummaryService } from "./opportunity-pipeline-summary.service";
import {
  makePipelineSummaryReadModel,
  makePipelineSummaryRow,
  pipelineActorId,
} from "./opportunity-pipeline-summary.test-fixtures";
import { InvalidPipelineSummaryOutputError } from "./opportunity-pipeline-summary.validation";

const id = "22222222-2222-4222-8222-000000000001";

describe("pipeline summary closed structured output", () => {
  it("rejects unknown enums, arbitrary prose, URLs, commands, confidence and probability recommendations", () => {
    const extras = [
      { reason: "Call this client" },
      { summary: "Generated prose" },
      { prose: "Call this client" },
      { url: "https://example.test" },
      { href: "/opportunities/unsafe" },
      { command: "move_stage" },
      { confidence: "high" },
      { probability: 99 },
      { probabilityRecommendation: 99 },
      { suggestedStage: "won" },
      { ownerId: id },
      { nested: { text: "untrusted" } },
    ];
    for (const extra of extras) {
      expect(
        pipelineSummarySchema.safeParse({
          overviewCode: "pipeline_requires_attention",
          focusAreas: [
            {
              code: "overdue_expected_close",
              opportunityIds: [id],
              ...extra,
            },
          ],
        }).success,
      ).toBe(false);
      expect(
        pipelineSummarySchema.safeParse({
          overviewCode: "pipeline_requires_attention",
          focusAreas: [
            { code: "overdue_expected_close", opportunityIds: [id] },
          ],
          ...extra,
        }).success,
      ).toBe(false);
    }
    expect(
      pipelineSummarySchema.safeParse({
        overviewCode: "unknown",
        focusAreas: [],
      }).success,
    ).toBe(false);
    expect(
      pipelineSummarySchema.safeParse({
        overviewCode: "pipeline_requires_attention",
        focusAreas: [{ code: "unknown", opportunityIds: [id] }],
      }).success,
    ).toBe(false);
    expect(
      pipelineSummarySchema.safeParse({
        overviewCode: "pipeline_requires_attention",
        focusAreas: [
          { code: "overdue_expected_close", opportunityIds: ["not-a-uuid"] },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects more than three focus areas or five IDs per focus", () => {
    const focus = { code: "overdue_expected_close", opportunityIds: [id] };
    expect(
      pipelineSummarySchema.safeParse({
        overviewCode: "pipeline_requires_attention",
        focusAreas: [focus, focus, focus, focus],
      }).success,
    ).toBe(false);
    expect(
      pipelineSummarySchema.safeParse({
        overviewCode: "pipeline_requires_attention",
        focusAreas: [
          {
            code: "overdue_expected_close",
            opportunityIds: Array.from({ length: 6 }, (_, index) =>
              `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
            ),
          },
        ],
      }).success,
    ).toBe(false);
  });

  it.each(["__proto__", "constructor", "prototype"])(
    "rejects top-level and nested parsed JSON reserved key %s",
    (key) => {
      const valid = {
        overviewCode: "pipeline_requires_attention",
        focusAreas: [
          { code: "overdue_expected_close", opportunityIds: [id] },
        ],
      };
      for (const nested of [false, true]) {
        const malicious = JSON.parse(JSON.stringify(valid));
        Object.defineProperty(
          nested ? malicious.focusAreas[0] : malicious,
          key,
          { enumerable: true, value: { unexpected: true } },
        );
        const raw = JSON.stringify(malicious);
        const reparsed = JSON.parse(raw);
        expect(
          Object.getOwnPropertyNames(
            nested ? reparsed.focusAreas[0] : reparsed,
          ),
        ).toContain(key);
        expect(() => parseRawPipelineSummaryJson(raw)).toThrow(
          UnsafePipelineSummaryStructureError,
        );
      }
    },
  );

  it("rejects non-standard prototypes and accessors without mutating them", () => {
    const nonStandard = Object.assign(Object.create({ inherited: true }), {
      overviewCode: "pipeline_requires_attention",
      focusAreas: [],
    });
    expect(() => assertSafePipelineSummaryJsonStructure(nonStandard)).toThrow(
      UnsafePipelineSummaryStructureError,
    );

    const accessor = { overviewCode: "pipeline_requires_attention", focusAreas: [] };
    Object.defineProperty(accessor, "unexpected", { get: () => "value" });
    expect(() => assertSafePipelineSummaryJsonStructure(accessor)).toThrow(
      UnsafePipelineSummaryStructureError,
    );
  });

  it("rejects an unsafe provider object before a rendered result can be returned", async () => {
    const row = makePipelineSummaryRow(1, {
      expected_close_date: "2026-08-01",
    });
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([row]),
      pipelineActorId,
      new Date("2026-08-08T12:00:00Z"),
    );
    const unsafeOutput = Object.assign(Object.create({ inherited: true }), {
      overviewCode: "pipeline_requires_attention",
      focusAreas: [
        { code: "overdue_expected_close", opportunityIds: [row.id] },
      ],
    });
    const service = new OpportunityPipelineSummaryService(
      { generate: async () => ({ output: unsafeOutput, usage: null }) },
      "gpt-5.6-terra",
    );
    await expect(service.generate(projection)).rejects.toBeInstanceOf(
      InvalidPipelineSummaryOutputError,
    );
  });
});
