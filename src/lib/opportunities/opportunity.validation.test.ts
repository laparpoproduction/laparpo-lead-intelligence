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
  validateOpportunityPipeline,
} from "./opportunity.validation";

const leadId = "11111111-1111-4111-8111-111111111111";

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
