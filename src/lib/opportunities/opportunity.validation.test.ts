import { describe, expect, it } from "vitest";
import {
  opportunityDefaultProbability,
  opportunityLossReasonValues,
  opportunityPipelineStageValues,
  opportunityServiceValues,
  isTerminalOpportunityStage,
  type OpportunityPipelineStage,
  type OpportunityService,
} from "./opportunity.types";
import {
  validateLeadConversion,
  validateOpportunityExpectedCloseMutation,
  validateOpportunityLostMutation,
  validateOpportunityMutationVersion,
  validateOpportunityOwnerMutation,
  validateOpportunityPipeline,
  validateOpportunityProbabilityMutation,
  validateOpportunityStageMutation,
} from "./opportunity.validation";

const leadId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";
const expectedUpdatedAt = "2026-07-27T08:00:00.000Z";

describe("Lead conversion validation", () => {
  it.each(opportunityServiceValues)(
    "accepts supported Opportunity service %s",
    (service: OpportunityService) => {
      expect(
        validateLeadConversion({
          leadId,
          service,
          estimatedValueMyr: 3500,
        }),
      ).toEqual({ leadId, service, estimatedValueMyr: 3500 });
    },
  );

  it("allows database mapping and currency-safe value resolution", () => {
    expect(validateLeadConversion({ leadId })).toEqual({
      leadId,
      service: null,
      estimatedValueMyr: null,
    });
  });

  it.each([
    { leadId: "not-a-uuid" },
    { leadId, service: "unsupported" },
    { leadId, estimatedValueMyr: -1 },
    { leadId, estimatedValueMyr: Number.NaN },
    { leadId, estimatedValueMyr: Number.POSITIVE_INFINITY },
    { leadId, estimatedValueMyr: 10_000_000_000 },
  ])("rejects malformed conversion input %#", (input) => {
    expect(() => validateLeadConversion(input as never)).toThrow();
  });
});

describe("Opportunity pipeline domain", () => {
  it.each([
    ["new", 20],
    ["discussion", 40],
    ["quotation_sent", 60],
    ["negotiation", 80],
    ["won", 100],
    ["lost", 0],
  ] as const)("keeps the canonical %s probability at %i", (stage, expected) => {
    expect(opportunityDefaultProbability[stage]).toBe(expected);
  });

  it("exports the exact stage and Lost reason taxonomies", () => {
    expect(opportunityPipelineStageValues).toEqual([
      "new",
      "discussion",
      "quotation_sent",
      "negotiation",
      "won",
      "lost",
    ]);
    expect(opportunityLossReasonValues).toEqual([
      "budget",
      "competitor",
      "no_response",
      "postponed",
      "scope_mismatch",
      "client_cancelled",
      "other",
    ]);
  });

  it.each([
    ["new", false],
    ["discussion", false],
    ["quotation_sent", false],
    ["negotiation", false],
    ["won", true],
    ["lost", true],
  ] as const)("classifies terminal stage %s", (stage, expected) => {
    expect(isTerminalOpportunityStage(stage as OpportunityPipelineStage)).toBe(
      expected,
    );
  });

  it("normalizes reusable pipeline input", () => {
    expect(
      validateOpportunityPipeline({
        pipelineStage: "quotation_sent",
        probabilityPercent: 85,
        probabilityOverridden: true,
        expectedCloseDate: "2026-08-01",
        ownerId: leadId,
        lostReasonNotes: "  ",
      }),
    ).toEqual({
      pipelineStage: "quotation_sent",
      probabilityPercent: 85,
      probabilityOverridden: true,
      expectedCloseDate: "2026-08-01",
      ownerId: leadId,
      lostReason: null,
      lostReasonNotes: null,
    });
  });

  it.each([
    {
      pipelineStage: "new",
      probabilityPercent: -1,
    },
    {
      pipelineStage: "new",
      probabilityPercent: 101,
    },
    {
      pipelineStage: "discussion",
      probabilityPercent: 20,
    },
    {
      pipelineStage: "won",
      probabilityPercent: 100,
      probabilityOverridden: true,
    },
    {
      pipelineStage: "new",
      probabilityPercent: 20,
      ownerId: "not-a-uuid",
    },
    {
      pipelineStage: "lost",
      probabilityPercent: 0,
    },
    {
      pipelineStage: "lost",
      probabilityPercent: 0,
      lostReason: "other",
      lostReasonNotes: " ",
    },
    {
      pipelineStage: "new",
      probabilityPercent: 20,
      lostReason: "budget",
    },
    {
      pipelineStage: "new",
      probabilityPercent: 20,
      expectedCloseDate: "01/08/2026",
    },
  ])("rejects invalid pipeline input %#", (input) => {
    expect(() => validateOpportunityPipeline(input as never)).toThrow();
  });

  it.each(opportunityLossReasonValues)(
    "accepts categorical Lost reason %s",
    (lostReason) => {
      expect(
        validateOpportunityPipeline({
          pipelineStage: "lost",
          probabilityPercent: 0,
          lostReason,
          lostReasonNotes:
            lostReason === "other" ? "Client changed direction" : null,
        }).lostReason,
      ).toBe(lostReason);
    },
  );
});

describe("Opportunity mutation validation", () => {
  it("accepts the four active stages and rejects terminal generic transitions", () => {
    for (const pipelineStage of [
      "new",
      "discussion",
      "quotation_sent",
      "negotiation",
    ] as const) {
      expect(
        validateOpportunityStageMutation({
          opportunityId,
          expectedUpdatedAt,
          pipelineStage,
        }).pipelineStage,
      ).toBe(pipelineStage);
    }
    for (const pipelineStage of ["won", "lost"]) {
      expect(() =>
        validateOpportunityStageMutation({
          opportunityId,
          expectedUpdatedAt,
          pipelineStage,
        }),
      ).toThrow();
    }
  });

  it("strictly validates the optimistic concurrency token", () => {
    expect(
      validateOpportunityMutationVersion({
        opportunityId,
        expectedUpdatedAt,
      }),
    ).toEqual({ opportunityId, expectedUpdatedAt });
    for (const invalid of [
      "2026-07-27",
      "2026-07-27T08:00:00",
      "not-a-version",
      "",
    ]) {
      expect(() =>
        validateOpportunityMutationVersion({
          opportunityId,
          expectedUpdatedAt: invalid,
        }),
      ).toThrow();
    }
  });

  it("accepts owner clear, past expected-close dates and integer probability", () => {
    expect(
      validateOpportunityOwnerMutation({
        opportunityId,
        expectedUpdatedAt,
        ownerId: null,
      }).ownerId,
    ).toBeNull();
    expect(
      validateOpportunityExpectedCloseMutation({
        opportunityId,
        expectedUpdatedAt,
        expectedCloseDate: "2020-01-01",
      }).expectedCloseDate,
    ).toBe("2020-01-01");
    expect(
      validateOpportunityProbabilityMutation({
        opportunityId,
        expectedUpdatedAt,
        probabilityPercent: 73,
      }).probabilityPercent,
    ).toBe(73);
  });

  it.each([-1, 1.5, 101, Number.NaN])(
    "rejects invalid probability %s",
    (probabilityPercent) => {
      expect(() =>
        validateOpportunityProbabilityMutation({
          opportunityId,
          expectedUpdatedAt,
          probabilityPercent,
        }),
      ).toThrow();
    },
  );

  it("normalizes Lost notes and requires an explanation for other", () => {
    expect(
      validateOpportunityLostMutation({
        opportunityId,
        expectedUpdatedAt,
        lostReason: "other",
        lostReasonNotes: "  Client paused the campaign  ",
      }).lostReasonNotes,
    ).toBe("Client paused the campaign");
    expect(() =>
      validateOpportunityLostMutation({
        opportunityId,
        expectedUpdatedAt,
        lostReason: "other",
        lostReasonNotes: " ",
      }),
    ).toThrow();
  });
});
