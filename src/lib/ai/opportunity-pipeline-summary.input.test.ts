import { describe, expect, it, vi } from "vitest";
import {
  PIPELINE_SUMMARY_MAX_INPUT_BYTES,
  serializePipelineSummaryInput,
} from "./opportunity-pipeline-summary.input";
import { projectOpportunityPipelineSummary } from "./opportunity-pipeline-summary.projection";
import { OpportunityPipelineSummaryService } from "./opportunity-pipeline-summary.service";
import {
  makePipelineSummaryReadModel,
  makePipelineSummaryRow,
  pipelineActorId,
} from "./opportunity-pipeline-summary.test-fixtures";

describe("pipeline summary bounded provider input", () => {
  it("contains pipeline facts but excludes Company/Lead labels, Contacts and notes", () => {
    const secretCompany = "FORBIDDEN-COMPANY-NAME";
    const secretLead = "FORBIDDEN-LEAD-TITLE";
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([
        makePipelineSummaryRow(1, {
          company_name: secretCompany,
          lead_title: secretLead,
          owner_id: null,
        }),
      ]),
      pipelineActorId,
      new Date("2026-08-07T12:00:00.000Z"),
    );
    const serialized = serializePipelineSummaryInput(projection.providerSnapshot);
    expect(serialized).toContain(makePipelineSummaryRow(1).id);
    expect(serialized).not.toContain(secretCompany);
    expect(serialized).not.toContain(secretLead);
    expect(serialized).not.toMatch(/email|phone|whatsapp|notes|contact/iu);
  });

  it("accepts 75 ordinary bounded rows within the exact byte ceiling", () => {
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel(
        Array.from({ length: 75 }, (_, index) =>
          makePipelineSummaryRow(index + 1),
        ),
      ),
      pipelineActorId,
      new Date("2026-08-07T12:00:00.000Z"),
    );
    const serialized = serializePipelineSummaryInput(projection.providerSnapshot);
    expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(
      PIPELINE_SUMMARY_MAX_INPUT_BYTES,
    );
  });

  it("enforces a 32 KiB UTF-8 ceiling before provider invocation", async () => {
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel(
        Array.from({ length: 75 }, (_, index) =>
          makePipelineSummaryRow(index + 1, {
            pipeline_stage: "quotation_sent",
            probability_percent: 60,
            expected_close_date: null,
            owner_id: null,
            probability_overridden: true,
            estimated_value_myr: index * 1_000,
          }),
        ),
      ),
      pipelineActorId,
      new Date("2026-08-07T12:00:00.000Z"),
    );
    const generate = vi.fn();
    const service = new OpportunityPipelineSummaryService(
      { generate },
      "gpt-5.6-terra",
    );
    await expect(service.generate(projection)).rejects.toMatchObject({
      name: "PipelineSummaryInputTooLargeError",
      limitBytes: PIPELINE_SUMMARY_MAX_INPUT_BYTES,
    });
    expect(generate).not.toHaveBeenCalled();
  });
});
