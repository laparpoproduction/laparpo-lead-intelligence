import { describe, expect, it } from "vitest";
import { OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT } from "@/lib/opportunities/opportunity.types";
import { projectOpportunityPipelineSummary } from "./opportunity-pipeline-summary.projection";
import {
  makePipelineSummaryReadModel,
  makePipelineSummaryRow,
  pipelineActorId,
} from "./opportunity-pipeline-summary.test-fixtures";

const now = new Date("2026-08-07T12:00:00.000Z");

function codes(rows: ReturnType<typeof makePipelineSummaryRow>[]) {
  return projectOpportunityPipelineSummary(
    makePipelineSummaryReadModel(rows),
    pipelineActorId,
    now,
  ).providerSnapshot.opportunities.map((row) => row.attentionCodes);
}

describe("AI Phase 1B synthetic quality matrix", () => {
  it("A. represents an empty active pipeline without invented focus", () => {
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([]),
      pipelineActorId,
      now,
    );
    expect(projection.expectedOverviewCode).toBe("no_active_opportunities");
    expect(projection.providerSnapshot.opportunities).toEqual([]);
  });

  it("B. preserves a complete New-only pipeline without invented facts", () => {
    expect(codes([makePipelineSummaryRow(1)])[0]).toEqual([]);
  });

  it("C. calculates passed expected-close dates from injected server time", () => {
    expect(
      codes([makePipelineSummaryRow(1, { expected_close_date: "2026-08-06" })])[0],
    ).toContain("overdue_expected_close");
  });

  it("D. identifies multiple unassigned active Opportunities", () => {
    expect(
      codes([
        makePipelineSummaryRow(1, { owner_id: null }),
        makePipelineSummaryRow(2, { owner_id: null }),
      ]),
    ).toEqual([
      expect.arrayContaining(["unassigned_active"]),
      expect.arrayContaining(["unassigned_active"]),
    ]);
  });

  it("E. deterministically ranks only the five highest persisted MYR values", () => {
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel(
        Array.from({ length: 7 }, (_, index) =>
          makePipelineSummaryRow(index + 1, {
            estimated_value_myr: (index + 1) * 1_000,
          }),
        ),
      ),
      pipelineActorId,
      now,
    );
    const high = projection.providerSnapshot.opportunities
      .filter((row) => row.attentionCodes.includes("high_recorded_value"))
      .map((row) => row.estimatedValueMyr);
    expect(high).toHaveLength(5);
    expect(high).not.toContain(1_000);
    expect(high).not.toContain(2_000);
  });

  it("F. grounds quotation follow-up in the persisted stage", () => {
    expect(
      codes([
        makePipelineSummaryRow(1, {
          pipeline_stage: "quotation_sent",
          probability_percent: 60,
        }),
      ])[0],
    ).toContain("quotation_follow_up");
  });

  it("G. grounds negotiation follow-up in the persisted stage", () => {
    expect(
      codes([
        makePipelineSummaryRow(1, {
          pipeline_stage: "negotiation",
          probability_percent: 80,
        }),
      ])[0],
    ).toContain("negotiation_follow_up");
  });

  it("H. flags but does not recompute a persisted probability override", () => {
    const row = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([
        makePipelineSummaryRow(1, {
          probability_overridden: true,
          probability_percent: 73,
        }),
      ]),
      pipelineActorId,
      now,
    ).providerSnapshot.opportunities[0]!;
    expect(row.probabilityPercent).toBe(73);
    expect(row.attentionCodes).toContain("review_probability_override");
  });

  it("I. identifies missing expected-close dates without converting null to a date", () => {
    const row = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([
        makePipelineSummaryRow(1, { expected_close_date: null }),
      ]),
      pipelineActorId,
      now,
    ).providerSnapshot.opportunities[0]!;
    expect(row.expectedCloseDate).toBeNull();
    expect(row.attentionCodes).toContain("missing_expected_close");
  });

  it("J. retains grounded predicates across a mixed portfolio", () => {
    const result = codes([
      makePipelineSummaryRow(1, { owner_id: null }),
      makePipelineSummaryRow(2, { expected_close_date: "2026-08-01" }),
      makePipelineSummaryRow(3, {
        pipeline_stage: "negotiation",
        probability_percent: 80,
      }),
    ]).flat();
    expect(result).toEqual(
      expect.arrayContaining([
        "unassigned_active",
        "overdue_expected_close",
        "negotiation_follow_up",
      ]),
    );
  });

  it("K. represents terminal-only portfolios through aggregate counts", () => {
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([], { won: 4, lost: 2 }),
      pipelineActorId,
      now,
    );
    expect(projection.providerSnapshot.stageCounts).toMatchObject({ won: 4, lost: 2 });
    expect(projection.providerSnapshot.opportunities).toEqual([]);
  });

  it("L. cannot expose a row omitted by the RLS-authoritative read model", () => {
    const accessible = makePipelineSummaryRow(1);
    const inaccessibleId = makePipelineSummaryRow(2).id;
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([accessible]),
      pipelineActorId,
      now,
    );
    expect(projection.displayById.has(accessible.id)).toBe(true);
    expect(projection.displayById.has(inaccessibleId)).toBe(false);
    expect(JSON.stringify(projection.providerSnapshot)).not.toContain(inaccessibleId);
  });

  it("M. rejects any in-memory dataset above the repository row ceiling", () => {
    const rows = Array.from(
      { length: OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT + 1 },
      (_, index) => makePipelineSummaryRow(index + 1),
    );
    expect(() =>
      projectOpportunityPipelineSummary(
        makePipelineSummaryReadModel(rows),
        pipelineActorId,
        now,
      ),
    ).toThrow("bounds");
  });

  it("accepts the RFC 3339 UTC offset emitted by PostgREST for updated_at", () => {
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([
        makePipelineSummaryRow(1, {
          updated_at: "2026-08-01T08:00:00.000+00:00",
        }),
      ]),
      pipelineActorId,
      now,
    );

    expect(projection.providerSnapshot.opportunities[0]?.daysSinceUpdated).toBe(
      6,
    );
  });
});
