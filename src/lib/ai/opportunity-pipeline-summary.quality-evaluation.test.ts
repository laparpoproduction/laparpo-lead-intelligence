import { describe, expect, it } from "vitest";
import { OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT } from "@/lib/opportunities/opportunity.types";
import { pipelineSummaryFocusCodeValues } from "./opportunity-pipeline-summary.types";
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

  it("E. never creates a subjective value-based focus", () => {
    const portfolios = [
      [null, null],
      [1],
      [0, 0, 0],
      [5_000, 5_000, 5_000],
      [9_999_999_999.99],
      [null, 0, 1, 8_000, 25_000],
    ];
    for (const [portfolioIndex, values] of portfolios.entries()) {
      const projection = projectOpportunityPipelineSummary(
        makePipelineSummaryReadModel(
          values.map((value, index) =>
            makePipelineSummaryRow(portfolioIndex * 10 + index + 1, {
              estimated_value_myr: value,
            }),
          ),
        ),
        pipelineActorId,
        now,
      );
      expect(
        projection.providerSnapshot.opportunities.flatMap(
          (row) => row.attentionCodes,
        ),
      ).toEqual([]);
      expect(JSON.stringify(projection.providerSnapshot)).not.toContain(
        "estimatedValueMyr",
      );
      expect(
        values.map(
          (_value, index) =>
            projection.displayById.get(
              makePipelineSummaryRow(portfolioIndex * 10 + index + 1).id,
            )?.estimatedValueMyr,
        ),
      ).toEqual(values);
    }
    expect(pipelineSummaryFocusCodeValues).not.toContain("high_recorded_value");
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

  it("keeps the projection and display map within a permission-filtered read model", () => {
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

  it("renders a repository-bounded 75-of-120 projection honestly", () => {
    const rows = Array.from(
      { length: OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT },
      (_, index) => makePipelineSummaryRow(index + 1),
    );
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel(rows, { new: 120 }),
      pipelineActorId,
      now,
    );
    expect(projection.providerSnapshot.activeOpportunityCount).toBe(120);
    expect(projection.providerSnapshot.analyzedCandidateCount).toBe(75);
    expect(projection.providerSnapshot.opportunities).toHaveLength(75);
    expect(projection.expectedOverviewCode).toBe("limited_pipeline_data");
  });

  it("applies the closed overview precedence for empty, truncated, complete, actionable and severe portfolios", () => {
    const noAttentionRows = Array.from({ length: 10 }, (_, index) =>
      makePipelineSummaryRow(index + 1),
    );
    const truncatedNoAttention = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel(noAttentionRows.slice(0, 5), { new: 120 }),
      pipelineActorId,
      now,
    );
    expect(truncatedNoAttention.expectedOverviewCode).toBe(
      "limited_pipeline_data",
    );

    const truncatedAttention = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel(
        [
          makePipelineSummaryRow(1, { expected_close_date: "2026-08-01" }),
          makePipelineSummaryRow(2, { owner_id: null }),
        ],
        { new: 120 },
      ),
      pipelineActorId,
      now,
    );
    expect(truncatedAttention.expectedOverviewCode).toBe(
      "limited_pipeline_data",
    );

    expect(
      projectOpportunityPipelineSummary(
        makePipelineSummaryReadModel(noAttentionRows),
        pipelineActorId,
        now,
      ).expectedOverviewCode,
    ).toBe("pipeline_no_grounded_attention");

    expect(
      projectOpportunityPipelineSummary(
        makePipelineSummaryReadModel([
          makePipelineSummaryRow(1, {
            pipeline_stage: "quotation_sent",
            probability_percent: 60,
          }),
          ...noAttentionRows.slice(1),
        ]),
        pipelineActorId,
        now,
      ).expectedOverviewCode,
    ).toBe("pipeline_has_actionable_items");

    expect(
      projectOpportunityPipelineSummary(
        makePipelineSummaryReadModel([
          makePipelineSummaryRow(1, { owner_id: null }),
          ...noAttentionRows.slice(1),
        ]),
        pipelineActorId,
        now,
      ).expectedOverviewCode,
    ).toBe("pipeline_requires_attention");
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

  it.each([
    "2026-08-01T08:00:00Z",
    "2026-08-01T08:00:00+00:00",
    "2026-08-01T10:00:00+02:00",
    "2026-08-01T00:00:00-08:00",
    "2026-08-01T08:00:00.123456Z",
  ])("parses valid RFC 3339 timestamp %s deterministically", (updatedAt) => {
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([
        makePipelineSummaryRow(1, { updated_at: updatedAt }),
      ]),
      pipelineActorId,
      now,
    );
    expect(projection.providerSnapshot.opportunities[0]?.daysSinceUpdated).toBe(
      6,
    );
  });

  it("clamps future timestamps and treats today as not overdue", () => {
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([
        makePipelineSummaryRow(1, {
          updated_at: "2026-08-08T12:00:00Z",
          expected_close_date: "2026-08-07",
        }),
      ]),
      pipelineActorId,
      now,
    );
    const row = projection.providerSnapshot.opportunities[0]!;
    expect(row.daysSinceUpdated).toBe(0);
    expect(row.overdueExpectedClose).toBe(false);
  });

  it("keeps yesterday/today/tomorrow and leap-day overdue boundaries deterministic", () => {
    const boundary = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([
        makePipelineSummaryRow(1, { expected_close_date: "2026-08-06" }),
        makePipelineSummaryRow(2, { expected_close_date: "2026-08-07" }),
        makePipelineSummaryRow(3, { expected_close_date: "2026-08-08" }),
      ]),
      pipelineActorId,
      now,
    ).providerSnapshot.opportunities;
    expect(boundary.map((row) => row.overdueExpectedClose)).toEqual([
      true,
      false,
      false,
    ]);

    const leapDay = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([
        makePipelineSummaryRow(4, { expected_close_date: "2024-02-29" }),
      ]),
      pipelineActorId,
      new Date("2024-03-01T00:00:00Z"),
    );
    expect(
      leapDay.providerSnapshot.opportunities[0]?.overdueExpectedClose,
    ).toBe(true);
  });

  it.each(["not-a-date", "2026-08-01", "2026-08-01T08:00:00"])(
    "rejects malformed or timezone-free updated_at value %s",
    (updatedAt) => {
      expect(() =>
        projectOpportunityPipelineSummary(
          makePipelineSummaryReadModel([
            makePipelineSummaryRow(1, { updated_at: updatedAt }),
          ]),
          pipelineActorId,
          now,
        ),
      ).toThrow();
    },
  );
});
