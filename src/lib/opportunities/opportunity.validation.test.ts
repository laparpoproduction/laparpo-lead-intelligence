import { describe, expect, it } from "vitest";
import {
  opportunityServiceValues,
  type OpportunityService,
} from "./opportunity.types";
import { validateLeadConversion } from "./opportunity.validation";

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
