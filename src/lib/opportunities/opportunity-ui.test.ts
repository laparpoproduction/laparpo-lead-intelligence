import { describe, expect, it } from "vitest";
import {
  defaultEstimatedValueMyr,
  mapLeadServiceToOpportunity,
  opportunityServiceOptions,
} from "./opportunity-ui";
import { canConvertLead, canEditLead } from "@/lib/leads/lead-ui";
import type { Lead, LeadActor } from "@/lib/leads/lead.types";

describe("Opportunity conversion UI helpers", () => {
  it("maps every supported Lead service explicitly", () => {
    expect([
      "food_review",
      "hard_selling_video",
      "corporate_video",
      "storyline_celebrity",
      "social_media_campaign",
      "event_coverage",
      "other",
    ].map(mapLeadServiceToOpportunity)).toEqual([
      "food_review",
      "hard_selling",
      "corporate",
      "storyline_celebrity",
      "social_media_campaign",
      "event_coverage",
      "other",
    ]);
    expect(opportunityServiceOptions).toHaveLength(7);
  });

  it("never silently maps an unknown service to other", () => {
    expect(mapLeadServiceToOpportunity("future_service")).toBeNull();
    expect(mapLeadServiceToOpportunity(null)).toBeNull();
  });

  it("prefills only valid MYR values and performs no FX conversion", () => {
    expect(defaultEstimatedValueMyr("MYR", 3500)).toBe(3500);
    expect(defaultEstimatedValueMyr("USD", 3500)).toBeNull();
    expect(defaultEstimatedValueMyr("MYR", Number.NaN)).toBeNull();
    expect(defaultEstimatedValueMyr("MYR", -1)).toBeNull();
  });

  it("keeps permission and terminal state eligibility aligned with the Lead UI", () => {
    const actor: LeadActor = {
      userId: "33333333-3333-4333-8333-333333333333",
      role: "sales_representative",
      isActive: true,
    };
    const lead = {
      id: "11111111-1111-4111-8111-111111111111",
      stage: "qualified",
      leadStatus: "active",
      assignedTo: actor.userId,
      createdBy: null,
      deletedAt: null,
    } as Lead;
    expect(canConvertLead(lead, actor)).toBe(true);
    expect(canConvertLead({ ...lead, leadStatus: "paused" }, actor)).toBe(true);
    expect(canConvertLead({ ...lead, stage: "lost" }, actor)).toBe(false);
    expect(canConvertLead({ ...lead, stage: "disqualified" }, actor)).toBe(
      false,
    );
    expect(canConvertLead({ ...lead, stage: "converted" }, actor)).toBe(false);
    expect(canEditLead({ ...lead, stage: "converted" }, actor)).toBe(false);
    expect(
      canConvertLead(
        { ...lead, assignedTo: null, createdBy: null },
        actor,
      ),
    ).toBe(false);
  });
});
