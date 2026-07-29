import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOpportunityContext: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  changePipelineStage: vi.fn(),
  assignOwner: vi.fn(),
  setExpectedCloseDate: vi.fn(),
  overrideProbability: vi.fn(),
  clearProbabilityOverride: vi.fn(),
  markWon: vi.fn(),
  markLost: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
  },
}));
vi.mock("@/lib/opportunities/opportunity.server", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/opportunities/opportunity.server")
  >("@/lib/opportunities/opportunity.server");
  return {
    ...actual,
    createOpportunityContext: mocks.createOpportunityContext,
  };
});

import {
  assignOpportunityOwnerAction,
  changeOpportunityStageAction,
  clearOpportunityProbabilityOverrideAction,
  markOpportunityLostAction,
  markOpportunityWonAction,
  overrideOpportunityProbabilityAction,
  setOpportunityExpectedCloseDateAction,
} from "./actions";
import { initialOpportunityMutationActionState } from "./form-state";
import {
  OpportunityMutationConflictError,
  OpportunityMutationEligibilityError,
  OpportunityMutationNotFoundError,
  OpportunityMutationPermissionError,
  OpportunityMutationUnavailableError,
} from "@/lib/opportunities/opportunity.service";
import { LeadConversionAuthError } from "@/lib/opportunities/opportunity.server";

const opportunityId = "22222222-2222-4222-8222-222222222222";
const leadId = "11111111-1111-4111-8111-111111111111";
const actor = {
  userId: "33333333-3333-4333-8333-333333333333",
  role: "sales_manager" as const,
  isActive: true,
};
const expectedUpdatedAt = "2026-07-27T08:00:00.000Z";
const updatedAt = "2026-07-27T09:00:00.000Z";
const opportunity = {
  id: opportunityId,
  leadId,
  service: "corporate" as const,
  estimatedValueMyr: 8000,
  quotationNumber: null,
  quotationSentAt: null,
  meetingAt: null,
  depositAmountMyr: null,
  depositReceivedAt: null,
  pipelineStage: "discussion" as const,
  probabilityPercent: 40,
  probabilityOverridden: false,
  expectedCloseDate: null,
  ownerId: null,
  wonAt: null,
  lostAt: null,
  lostReason: null,
  lostReasonNotes: null,
  createdAt: expectedUpdatedAt,
  updatedAt,
};

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  data.set("opportunityId", opportunityId);
  data.set("expectedUpdatedAt", expectedUpdatedAt);
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const mutation of [
    mocks.changePipelineStage,
    mocks.assignOwner,
    mocks.setExpectedCloseDate,
    mocks.overrideProbability,
    mocks.clearProbabilityOverride,
    mocks.markWon,
    mocks.markLost,
  ]) {
    mutation.mockResolvedValue({ status: "applied", opportunity });
  }
  mocks.createOpportunityContext.mockResolvedValue({
    actor,
    service: {
      changePipelineStage: mocks.changePipelineStage,
      assignOwner: mocks.assignOwner,
      setExpectedCloseDate: mocks.setExpectedCloseDate,
      overrideProbability: mocks.overrideProbability,
      clearProbabilityOverride: mocks.clearProbabilityOverride,
      markWon: mocks.markWon,
      markLost: mocks.markLost,
    },
  });
});

describe("Opportunity mutation actions", () => {
  it("resolves actor server-side, ignores injected identity and revalidates only Opportunity routes", async () => {
    const data = form({ pipelineStage: "discussion" });
    data.set("actorId", "forged");
    data.set("role", "ceo_admin");
    data.set("leadId", "44444444-4444-4444-8444-444444444444");
    data.set("wonAt", "2000-01-01T00:00:00Z");
    data.set("estimatedValueMyr", "999999");

    await expect(
      changeOpportunityStageAction(
        initialOpportunityMutationActionState,
        data,
      ),
    ).resolves.toEqual({
      status: "success",
      message: "Opportunity updated successfully.",
      opportunityId,
      updatedAt,
    });
    expect(mocks.changePipelineStage).toHaveBeenCalledWith(
      {
        opportunityId,
        expectedUpdatedAt,
        pipelineStage: "discussion",
      },
      actor,
    );
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/opportunities"],
      ["/opportunities/pipeline"],
      [`/opportunities/${opportunityId}`],
    ]);
  });

  it("delegates every remaining allow-listed workflow", async () => {
    await assignOpportunityOwnerAction(
      initialOpportunityMutationActionState,
      form({ ownerId: actor.userId }),
    );
    expect(mocks.assignOwner).toHaveBeenCalledWith(
      { opportunityId, expectedUpdatedAt, ownerId: actor.userId },
      actor,
    );

    await setOpportunityExpectedCloseDateAction(
      initialOpportunityMutationActionState,
      form({ expectedCloseDate: "2020-01-01" }),
    );
    expect(mocks.setExpectedCloseDate).toHaveBeenCalledWith(
      {
        opportunityId,
        expectedUpdatedAt,
        expectedCloseDate: "2020-01-01",
      },
      actor,
    );

    await overrideOpportunityProbabilityAction(
      initialOpportunityMutationActionState,
      form({ probabilityPercent: "75" }),
    );
    expect(mocks.overrideProbability).toHaveBeenCalledWith(
      { opportunityId, expectedUpdatedAt, probabilityPercent: 75 },
      actor,
    );

    await clearOpportunityProbabilityOverrideAction(
      initialOpportunityMutationActionState,
      form(),
    );
    expect(mocks.clearProbabilityOverride).toHaveBeenCalledWith(
      { opportunityId, expectedUpdatedAt },
      actor,
    );

    await markOpportunityWonAction(
      initialOpportunityMutationActionState,
      form(),
    );
    expect(mocks.markWon).toHaveBeenCalledWith(
      { opportunityId, expectedUpdatedAt },
      actor,
    );

    await markOpportunityLostAction(
      initialOpportunityMutationActionState,
      form({
        lostReason: "other",
        lostReasonNotes: "  Client changed direction  ",
      }),
    );
    expect(mocks.markLost).toHaveBeenCalledWith(
      {
        opportunityId,
        expectedUpdatedAt,
        lostReason: "other",
        lostReasonNotes: "Client changed direction",
      },
      actor,
    );
  });

  it("returns validation state before calling the service", async () => {
    const result = await changeOpportunityStageAction(
      initialOpportunityMutationActionState,
      form({ pipelineStage: "won" }),
    );
    expect(result).toMatchObject({
      status: "validation_error",
      fieldErrors: { pipelineStage: expect.any(Array) },
    });
    expect(mocks.changePipelineStage).not.toHaveBeenCalled();
  });

  it.each([
    [new OpportunityMutationPermissionError(), "forbidden"],
    [new OpportunityMutationNotFoundError(), "not_found"],
    [new OpportunityMutationConflictError(), "conflict"],
    [new OpportunityMutationEligibilityError("terminal"), "ineligible"],
    [new OpportunityMutationUnavailableError(), "unavailable"],
  ] as const)("maps safe domain error to %s", async (error, status) => {
    mocks.markWon.mockRejectedValueOnce(error);
    const result = await markOpportunityWonAction(
      initialOpportunityMutationActionState,
      form(),
    );
    expect(result.status).toBe(status);
    expect(result.message).not.toContain("SQL");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns already_applied and still refreshes the authoritative reads", async () => {
    mocks.markWon.mockResolvedValueOnce({
      status: "already_applied",
      opportunity,
    });
    await expect(
      markOpportunityWonAction(
        initialOpportunityMutationActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status: "already_applied", opportunityId });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["unauthenticated", "unauthenticated"],
    ["inactive", "inactive"],
    ["invalid_profile", "unavailable"],
  ] as const)("maps server auth %s safely", async (code, status) => {
    mocks.createOpportunityContext.mockRejectedValueOnce(
      new LeadConversionAuthError(code),
    );
    const result = await markOpportunityWonAction(
      initialOpportunityMutationActionState,
      form(),
    );
    expect(result.status).toBe(status);
    expect(mocks.markWon).not.toHaveBeenCalled();
  });

  it("logs only safe metadata for an unexpected failure", async () => {
    mocks.markWon.mockRejectedValueOnce(new Error("raw SQL policy secret"));
    const result = await markOpportunityWonAction(
      initialOpportunityMutationActionState,
      form(),
    );
    expect(result).toMatchObject({ status: "unavailable" });
    expect(result.message).not.toContain("secret");
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "CRM mutation failed",
      expect.objectContaining({
        operation: "mark_opportunity_won",
        actorId: actor.userId,
        errorName: "Error",
        outcome: "unexpected",
        requestId: expect.any(String),
        resourceType: "opportunity",
      }),
    );
  });
});
