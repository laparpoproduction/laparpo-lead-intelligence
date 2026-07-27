import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  LeadConversionEligibilityError,
  LeadConversionNotFoundError,
  LeadConversionPermissionError,
  LeadConversionUnavailableError,
} from "@/lib/opportunities/opportunity.service";
import {
  createLeadConversionContext,
  LeadConversionAuthError,
} from "@/lib/opportunities/opportunity.server";
import { convertLeadToOpportunityAction } from "./actions";
import { initialLeadConversionActionState } from "./form-state";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/opportunities/opportunity.server", () => ({
  createLeadConversionContext: vi.fn(),
  LeadConversionAuthError: class LeadConversionAuthError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
}));

const leadId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";
const actor = {
  userId: "33333333-3333-4333-8333-333333333333",
  role: "sales_manager" as const,
  isActive: true,
};
const service = { convert: vi.fn() };

function form(
  values: Partial<Record<string, string>> = {},
): FormData {
  const data = new FormData();
  data.set("leadId", values.leadId ?? leadId);
  data.set("service", values.service ?? "food_review");
  data.set("estimatedValueMyr", values.estimatedValueMyr ?? "3500");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createLeadConversionContext).mockResolvedValue({
    actor,
    service,
  } as never);
  service.convert.mockResolvedValue({
    leadId,
    opportunityId,
    status: "converted",
  });
});

describe("convertLeadToOpportunityAction", () => {
  it("converts valid allow-listed input and revalidates Lead routes", async () => {
    const data = form();
    data.set("createdBy", "attacker");
    data.set("opportunityId", "attacker");
    data.set("convertedAt", "attacker");
    data.set("conversionStatus", "attacker");

    await expect(
      convertLeadToOpportunityAction(initialLeadConversionActionState, data),
    ).resolves.toEqual({
      status: "success",
      message: "Lead converted to an Opportunity successfully.",
      leadId,
      opportunityId,
    });
    expect(service.convert).toHaveBeenCalledWith(
      { leadId, service: "food_review", estimatedValueMyr: 3500 },
      actor,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/leads");
    expect(revalidatePath).toHaveBeenCalledWith(`/leads/${leadId}`);
  });

  it("treats an already-converted replay as a safe successful outcome", async () => {
    service.convert.mockResolvedValueOnce({
      leadId,
      opportunityId,
      status: "already_converted",
    });
    await expect(
      convertLeadToOpportunityAction(
        initialLeadConversionActionState,
        form(),
      ),
    ).resolves.toMatchObject({
      status: "already_converted",
      opportunityId,
    });
  });

  it.each([
    ["leadId", { leadId: "not-a-uuid" }],
    ["service", { service: "unknown" }],
    ["estimatedValueMyr", { estimatedValueMyr: "not-money" }],
    ["estimatedValueMyr", { estimatedValueMyr: "-1" }],
    ["estimatedValueMyr", { estimatedValueMyr: "10000000000" }],
  ])("returns field validation for invalid %s", async (field, values) => {
    const state = await convertLeadToOpportunityAction(
      initialLeadConversionActionState,
      form(values),
    );
    expect(state.status).toBe("validation_error");
    expect(state.fieldErrors?.[field]).toBeDefined();
    expect(service.convert).not.toHaveBeenCalled();
  });

  it.each([
    [
      new LeadConversionAuthError("unauthenticated"),
      "unauthenticated",
    ],
    [new LeadConversionAuthError("inactive"), "inactive"],
  ])("maps authentication state without parsing client actor data", async (
    error,
    status,
  ) => {
    vi.mocked(createLeadConversionContext).mockRejectedValueOnce(error);
    await expect(
      convertLeadToOpportunityAction(
        initialLeadConversionActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status });
  });

  it.each([
    [new LeadConversionPermissionError(), "forbidden"],
    [new LeadConversionNotFoundError(), "not_found"],
    [new LeadConversionEligibilityError("terminal"), "ineligible"],
    [new LeadConversionEligibilityError("legacy"), "legacy_unresolved"],
    [new LeadConversionEligibilityError("conflict"), "ineligible"],
    [new LeadConversionUnavailableError(), "unavailable"],
    [new Error("raw database secret"), "unavailable"],
  ])("maps domain failure safely", async (error, status) => {
    service.convert.mockRejectedValueOnce(error);
    const state = await convertLeadToOpportunityAction(
      initialLeadConversionActionState,
      form(),
    );
    expect(state.status).toBe(status);
    expect(state.message).not.toContain("secret");
  });

  it("preserves service validation issues from the domain", async () => {
    service.convert.mockRejectedValueOnce(
      new z.ZodError([
        {
          code: "custom",
          path: ["service"],
          message: "Choose a service.",
        },
      ]),
    );
    const state = await convertLeadToOpportunityAction(
      initialLeadConversionActionState,
      form(),
    );
    expect(state).toMatchObject({
      status: "validation_error",
      fieldErrors: { service: ["Choose a service."] },
    });
  });
});
