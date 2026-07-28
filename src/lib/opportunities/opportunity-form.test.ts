import { describe, expect, it } from "vitest";
import {
  parseOpportunityExpectedCloseMutationForm,
  parseOpportunityLostMutationForm,
  parseOpportunityOwnerMutationForm,
  parseOpportunityProbabilityMutationForm,
  parseOpportunityStageMutationForm,
  parseOpportunityVersionedMutationForm,
} from "./opportunity-form";

const opportunityId = "22222222-2222-4222-8222-222222222222";
const expectedUpdatedAt = "2026-07-27T08:00:00.000Z";

function form(
  values: Record<string, string> = {},
  injected: Record<string, string> = {},
) {
  const result = new FormData();
  result.set("opportunityId", opportunityId);
  result.set("expectedUpdatedAt", expectedUpdatedAt);
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  for (const [key, value] of Object.entries(injected)) result.set(key, value);
  return result;
}

describe("Opportunity mutation FormData allow-lists", () => {
  it("parses only the active-stage intention", () => {
    expect(
      parseOpportunityStageMutationForm(
        form(
          { pipelineStage: "discussion" },
          {
            actorId: "forged",
            role: "ceo_admin",
            leadId: "11111111-1111-4111-8111-111111111111",
            wonAt: "2000-01-01T00:00:00Z",
            probabilityOverridden: "true",
          },
        ),
      ),
    ).toEqual({ opportunityId, expectedUpdatedAt, pipelineStage: "discussion" });
  });

  it("normalizes clearable owner and expected-close values", () => {
    expect(
      parseOpportunityOwnerMutationForm(form({ ownerId: "" })),
    ).toEqual({ opportunityId, expectedUpdatedAt, ownerId: null });
    expect(
      parseOpportunityExpectedCloseMutationForm(
        form({ expectedCloseDate: "" }),
      ),
    ).toEqual({ opportunityId, expectedUpdatedAt, expectedCloseDate: null });
  });

  it("coerces only the allow-listed probability field", () => {
    expect(
      parseOpportunityProbabilityMutationForm(
        form(
          { probabilityPercent: "75" },
          { estimatedValueMyr: "9999999", userId: "forged" },
        ),
      ),
    ).toEqual({ opportunityId, expectedUpdatedAt, probabilityPercent: 75 });
  });

  it("keeps Mark Won and clear-override payloads version-only", () => {
    expect(
      parseOpportunityVersionedMutationForm(
        form({}, { lostAt: "2000-01-01T00:00:00Z", service: "corporate" }),
      ),
    ).toEqual({ opportunityId, expectedUpdatedAt });
  });

  it("normalizes only categorical Lost input", () => {
    expect(
      parseOpportunityLostMutationForm(
        form(
          {
            lostReason: "other",
            lostReasonNotes: "  Client cancelled after review  ",
          },
          {
            createdBy: "forged",
            createdAt: "2000-01-01T00:00:00Z",
            depositAmountMyr: "1000",
            conversionOpportunity: "true",
          },
        ),
      ),
    ).toEqual({
      opportunityId,
      expectedUpdatedAt,
      lostReason: "other",
      lostReasonNotes: "Client cancelled after review",
    });
  });
});
