import { describe, expect, it } from "vitest";
import { pipelineSummarySchema } from "./opportunity-pipeline-summary.schema";

const id = "22222222-2222-4222-8222-000000000001";

describe("pipeline summary closed structured output", () => {
  it("rejects unknown enums, arbitrary prose, URLs, commands, confidence and probability recommendations", () => {
    const extras = [
      { prose: "Call this client" },
      { url: "https://example.test" },
      { command: "move_stage" },
      { confidence: "high" },
      { probabilityRecommendation: 99 },
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
    }
    expect(
      pipelineSummarySchema.safeParse({
        overviewCode: "unknown",
        focusAreas: [],
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
});
