import { describe, expect, it } from "vitest";
import { projectOpportunityPipelineSummary } from "./opportunity-pipeline-summary.projection";
import { renderPipelineSummary } from "./opportunity-pipeline-summary.render";
import {
  makePipelineSummaryReadModel,
  makePipelineSummaryRow,
  pipelineActorId,
} from "./opportunity-pipeline-summary.test-fixtures";

describe("pipeline summary deterministic application renderer", () => {
  it("renders application-owned review text and authorized display labels", () => {
    const row = makePipelineSummaryRow(1, {
      expected_close_date: "2026-08-01",
    });
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([row]),
      pipelineActorId,
      new Date("2026-08-07T12:00:00.000Z"),
    );
    const rendered = renderPipelineSummary(projection, {
      overviewCode: "pipeline_requires_attention",
      focusAreas: [
        { code: "overdue_expected_close", opportunityIds: [row.id] },
      ],
    });
    expect(rendered.overview).toContain("AI-assisted prioritization");
    expect(rendered.focusAreas[0]).toMatchObject({
      heading: "Expected-close dates that have passed",
      opportunities: [{ label: `${row.lead_title} — ${row.company_name}` }],
    });
    expect(JSON.stringify(rendered)).not.toMatch(/confidence|AI decided/iu);
  });

  it("renders the complete no-attention state without claiming pipeline health", () => {
    const row = makePipelineSummaryRow(2);
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([row]),
      pipelineActorId,
      new Date("2026-08-07T12:00:00.000Z"),
    );
    const rendered = renderPipelineSummary(projection, {
      overviewCode: "pipeline_no_grounded_attention",
      focusAreas: [],
    });
    expect(rendered.overview).toBe(
      "No configured attention signals were found in the accessible active Opportunities.",
    );
    expect(rendered.overview).not.toMatch(/healthy|guaranteed|conversion/iu);
  });
});
