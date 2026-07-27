import { describe, expect, it, vi } from "vitest";
import {
  OpportunityRepositoryError,
  type OpportunityRepository,
} from "./opportunity.repository";
import {
  LeadConversionEligibilityError,
  LeadConversionNotFoundError,
  LeadConversionPermissionError,
  LeadConversionService,
  LeadConversionUnavailableError,
  LeadConversionValidationError,
  OpportunityListUnavailableError,
  OpportunityListValidationError,
  OpportunityDetailUnavailableError,
  OpportunityDetailValidationError,
  OpportunityMutationConflictError,
  OpportunityMutationEligibilityError,
  OpportunityMutationNotFoundError,
  OpportunityMutationPermissionError,
  OpportunityMutationUnavailableError,
  OpportunityMutationValidationError,
} from "./opportunity.service";
import type { Opportunity } from "./opportunity.types";

const leadId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";
const manager = {
  userId: "33333333-3333-4333-8333-333333333333",
  role: "sales_manager" as const,
  isActive: true,
};
const representative = {
  ...manager,
  userId: "44444444-4444-4444-8444-444444444444",
  role: "sales_representative" as const,
};
const version = "2026-07-27T08:00:00.000Z";
const opportunity: Opportunity = {
  id: opportunityId,
  leadId,
  service: "corporate",
  estimatedValueMyr: 8000,
  quotationNumber: null,
  quotationSentAt: null,
  meetingAt: null,
  depositAmountMyr: null,
  depositReceivedAt: null,
  pipelineStage: "new",
  probabilityPercent: 20,
  probabilityOverridden: false,
  expectedCloseDate: null,
  ownerId: null,
  wonAt: null,
  lostAt: null,
  lostReason: null,
  lostReasonNotes: null,
  createdAt: version,
  updatedAt: version,
};

function repository(
  overrides: Partial<OpportunityRepository> = {},
): OpportunityRepository {
  return {
    convert: vi.fn().mockResolvedValue({
      leadId,
      opportunityId,
      status: "converted",
    }),
    getConversionByLead: vi.fn().mockResolvedValue(null),
    getById: vi.fn().mockResolvedValue(null),
    getDetailById: vi.fn().mockResolvedValue(null),
    listByLead: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
    }),
    canModifyLead: vi.fn().mockResolvedValue(true),
    changePipelineStage: vi.fn().mockResolvedValue({
      ...opportunity,
      pipelineStage: "discussion",
      probabilityPercent: 40,
      updatedAt: "2026-07-27T09:00:00.000Z",
    }),
    assignOwner: vi.fn().mockResolvedValue({
      ...opportunity,
      ownerId: manager.userId,
      updatedAt: "2026-07-27T09:00:00.000Z",
    }),
    setExpectedCloseDate: vi.fn().mockResolvedValue({
      ...opportunity,
      expectedCloseDate: "2026-08-15",
      updatedAt: "2026-07-27T09:00:00.000Z",
    }),
    overrideProbability: vi.fn().mockResolvedValue({
      ...opportunity,
      probabilityPercent: 75,
      probabilityOverridden: true,
      updatedAt: "2026-07-27T09:00:00.000Z",
    }),
    clearProbabilityOverride: vi.fn().mockResolvedValue(opportunity),
    markWon: vi.fn().mockResolvedValue({
      ...opportunity,
      pipelineStage: "won",
      probabilityPercent: 100,
      wonAt: "2026-07-27T09:00:00.000Z",
      updatedAt: "2026-07-27T09:00:00.000Z",
    }),
    markLost: vi.fn().mockResolvedValue({
      ...opportunity,
      pipelineStage: "lost",
      probabilityPercent: 0,
      lostAt: "2026-07-27T09:00:00.000Z",
      lostReason: "budget",
      updatedAt: "2026-07-27T09:00:00.000Z",
    }),
    ...overrides,
  };
}

describe("LeadConversionService", () => {
  it.each([manager, representative])(
    "delegates eligible actor conversion to the database boundary",
    async (actor) => {
      const data = repository();
      const service = new LeadConversionService(data);
      await expect(
        service.convert(
          { leadId, service: "corporate", estimatedValueMyr: 8000 },
          actor,
        ),
      ).resolves.toEqual({
        leadId,
        opportunityId,
        status: "converted",
      });
      expect(data.convert).toHaveBeenCalledWith({
        leadId,
        service: "corporate",
        estimatedValueMyr: 8000,
      });
    },
  );

  it("returns the stable Opportunity on a retry", async () => {
    const data = repository({
      convert: vi.fn().mockResolvedValue({
        leadId,
        opportunityId,
        status: "already_converted",
      }),
    });
    await expect(
      new LeadConversionService(data).convert({ leadId }, manager),
    ).resolves.toMatchObject({
      opportunityId,
      status: "already_converted",
    });
  });

  it("rejects inactive or malformed actors before repository access", async () => {
    const data = repository();
    const service = new LeadConversionService(data);
    await expect(
      service.convert({ leadId }, { ...representative, isActive: false }),
    ).rejects.toBeInstanceOf(LeadConversionPermissionError);
    await expect(
      service.convert(
        { leadId },
        { ...representative, userId: "guessed-user" },
      ),
    ).rejects.toBeInstanceOf(LeadConversionPermissionError);
    expect(data.convert).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", LeadConversionNotFoundError],
    ["permission_denied", LeadConversionPermissionError],
    ["inactive_actor", LeadConversionPermissionError],
    ["terminal_lead", LeadConversionEligibilityError],
    ["legacy_conversion_unresolved", LeadConversionEligibilityError],
    ["conversion_state_conflict", LeadConversionEligibilityError],
    ["unsupported_service", LeadConversionValidationError],
    ["invalid_value", LeadConversionValidationError],
    ["unknown", LeadConversionUnavailableError],
  ] as const)(
    "maps repository failure %s to a safe domain error",
    async (failure, expected) => {
      const service = new LeadConversionService(
        repository({
          convert: vi
            .fn()
            .mockRejectedValue(
              new OpportunityRepositoryError(
                "conversion",
                failure,
                new Error("raw database secret"),
              ),
            ),
        }),
      );
      const error = await service
        .convert({ leadId, service: "food_review" }, manager)
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(expected);
      expect((error as Error).message).not.toContain("secret");
    },
  );

  it("validates raw input before it reaches the repository", async () => {
    const data = repository();
    const service = new LeadConversionService(data);
    await expect(
      service.convert(
        { leadId: "invalid", estimatedValueMyr: Number.NaN },
        manager,
      ),
    ).rejects.toBeInstanceOf(LeadConversionValidationError);
    expect(data.convert).not.toHaveBeenCalled();
  });

  it("retrieves Lead-scoped conversion metadata for an active actor", async () => {
    const conversion = {
      leadId,
      opportunityId,
      convertedAt: "2026-07-27T08:00:00.000Z",
      createdBy: manager.userId,
      createdAt: "2026-07-27T08:00:00.000Z",
    };
    const data = repository({
      getConversionByLead: vi.fn().mockResolvedValue(conversion),
    });
    await expect(
      new LeadConversionService(data).getConversionByLead(leadId, manager),
    ).resolves.toEqual(conversion);
    expect(data.getConversionByLead).toHaveBeenCalledWith(leadId);
  });

  it("retrieves an Opportunity detail projection for an active actor", async () => {
    const detail = {
      id: opportunityId,
      leadId,
      leadTitle: "Campaign",
      companyId: null,
      companyName: null,
      service: "corporate" as const,
      estimatedValueMyr: 8000,
      quotationNumber: null,
      quotationSentAt: null,
      meetingAt: null,
      depositAmountMyr: null,
      depositReceivedAt: null,
      pipelineStage: "negotiation" as const,
      probabilityPercent: 85,
      probabilityOverridden: true,
      expectedCloseDate: "2026-08-15",
      ownerId: manager.userId,
      wonAt: null,
      lostAt: null,
      lostReason: null,
      lostReasonNotes: null,
      createdAt: "2026-07-27T08:00:00.000Z",
      updatedAt: "2026-07-27T08:00:00.000Z",
      isConversion: false,
      convertedAt: null,
    };
    const data = repository({
      getDetailById: vi.fn().mockResolvedValue(detail),
    });
    await expect(
      new LeadConversionService(data).getDetailById(
        opportunityId,
        representative,
      ),
    ).resolves.toEqual(detail);
    expect(data.getDetailById).toHaveBeenCalledWith(opportunityId);
  });

  it("rejects inactive and malformed detail requests before repository access", async () => {
    const data = repository();
    const service = new LeadConversionService(data);
    await expect(
      service.getDetailById(opportunityId, {
        ...representative,
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(LeadConversionPermissionError);
    await expect(
      service.getDetailById("malformed", representative),
    ).rejects.toBeInstanceOf(OpportunityDetailValidationError);
    expect(data.getDetailById).not.toHaveBeenCalled();
  });

  it("maps detail repository failures to a safe unavailable error", async () => {
    const data = repository({
      getDetailById: vi.fn().mockRejectedValue(
        new OpportunityRepositoryError(
          "get detail",
          "unknown",
          new Error("secret database payload"),
        ),
      ),
    });
    const error = await new LeadConversionService(data)
      .getDetailById(opportunityId, manager)
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(OpportunityDetailUnavailableError);
    expect((error as Error).message).not.toContain("secret");
  });

  it("validates and delegates the global read list for an active actor", async () => {
    const data = repository();
    await expect(
      new LeadConversionService(data).list(
        {
          query: "  agency  ",
          service: "corporate",
          kind: "ordinary",
          sort: "value_desc",
          page: 2,
          pageSize: 25,
        },
        representative,
      ),
    ).resolves.toMatchObject({ page: 1, total: 0 });
    expect(data.list).toHaveBeenCalledWith({
      query: "agency",
      service: "corporate",
      kind: "ordinary",
      sort: "value_desc",
      page: 2,
      pageSize: 25,
    });
  });

  it("rejects malformed list options before repository access", async () => {
    const data = repository();
    await expect(
      new LeadConversionService(data).list(
        { page: -1, pageSize: 25 },
        manager,
      ),
    ).rejects.toBeInstanceOf(OpportunityListValidationError);
    expect(data.list).not.toHaveBeenCalled();
  });

  it("rejects inactive list actors before repository access", async () => {
    const data = repository();
    await expect(
      new LeadConversionService(data).list(
        {},
        { ...manager, isActive: false },
      ),
    ).rejects.toBeInstanceOf(LeadConversionPermissionError);
    expect(data.list).not.toHaveBeenCalled();
  });

  it("maps repository list failures to a safe domain failure", async () => {
    const data = repository({
      list: vi.fn().mockRejectedValue(
        new OpportunityRepositoryError(
          "global list",
          "unknown",
          new Error("secret SQL"),
        ),
      ),
    });
    const error = await new LeadConversionService(data)
      .list({}, manager)
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(OpportunityListUnavailableError);
    expect((error as Error).message).not.toContain("secret");
  });

  it("changes only an active stage through the dedicated repository method", async () => {
    const data = repository({
      getById: vi.fn().mockResolvedValue(opportunity),
    });
    const result = await new LeadConversionService(data).changePipelineStage(
      {
        opportunityId,
        expectedUpdatedAt: version,
        pipelineStage: "discussion",
      },
      representative,
    );
    expect(result.status).toBe("applied");
    expect(data.changePipelineStage).toHaveBeenCalledWith({
      opportunityId,
      expectedUpdatedAt: version,
      pipelineStage: "discussion",
    });
  });

  it("rejects terminal generic stages and terminal reopening", async () => {
    const data = repository({
      getById: vi.fn().mockResolvedValue({
        ...opportunity,
        pipelineStage: "won",
        probabilityPercent: 100,
        wonAt: version,
      }),
    });
    const service = new LeadConversionService(data);
    await expect(
      service.changePipelineStage(
        {
          opportunityId,
          expectedUpdatedAt: version,
          pipelineStage: "lost" as never,
        },
        manager,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationValidationError);
    await expect(
      service.changePipelineStage(
        {
          opportunityId,
          expectedUpdatedAt: version,
          pipelineStage: "discussion",
        },
        manager,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationEligibilityError);
    expect(data.changePipelineStage).not.toHaveBeenCalled();
  });

  it("enforces management-only probability override and clear", async () => {
    const data = repository({
      getById: vi.fn().mockResolvedValue(opportunity),
    });
    const service = new LeadConversionService(data);
    await expect(
      service.overrideProbability(
        {
          opportunityId,
          expectedUpdatedAt: version,
          probabilityPercent: 75,
        },
        manager,
      ),
    ).resolves.toMatchObject({ status: "applied" });
    await expect(
      service.overrideProbability(
        {
          opportunityId,
          expectedUpdatedAt: version,
          probabilityPercent: 75,
        },
        representative,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationPermissionError);
    await expect(
      service.clearProbabilityOverride(
        { opportunityId, expectedUpdatedAt: version },
        representative,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationPermissionError);
  });

  it("allows management assignment and only representative self-claim", async () => {
    const selfClaimData = repository({
      getById: vi.fn().mockResolvedValue(opportunity),
      assignOwner: vi.fn().mockResolvedValue({
        ...opportunity,
        ownerId: representative.userId,
      }),
    });
    await expect(
      new LeadConversionService(selfClaimData).assignOwner(
        {
          opportunityId,
          expectedUpdatedAt: version,
          ownerId: representative.userId,
        },
        representative,
      ),
    ).resolves.toMatchObject({ status: "applied" });

    const owned = repository({
      getById: vi.fn().mockResolvedValue({
        ...opportunity,
        ownerId: manager.userId,
      }),
    });
    await expect(
      new LeadConversionService(owned).assignOwner(
        {
          opportunityId,
          expectedUpdatedAt: version,
          ownerId: representative.userId,
        },
        representative,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationPermissionError);
    await expect(
      new LeadConversionService(owned).assignOwner(
        {
          opportunityId,
          expectedUpdatedAt: version,
          ownerId: null,
        },
        representative,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationPermissionError);
  });

  it("permits a past expected close without moving pipeline stage", async () => {
    const data = repository({
      getById: vi.fn().mockResolvedValue(opportunity),
      setExpectedCloseDate: vi.fn().mockResolvedValue({
        ...opportunity,
        expectedCloseDate: "2020-01-01",
      }),
    });
    await expect(
      new LeadConversionService(data).setExpectedCloseDate(
        {
          opportunityId,
          expectedUpdatedAt: version,
          expectedCloseDate: "2020-01-01",
        },
        representative,
      ),
    ).resolves.toMatchObject({
      status: "applied",
      opportunity: {
        pipelineStage: "new",
        expectedCloseDate: "2020-01-01",
      },
    });
  });

  it("returns already_applied for an authorized semantic replay", async () => {
    const data = repository({
      getById: vi.fn().mockResolvedValue({
        ...opportunity,
        pipelineStage: "discussion",
        probabilityPercent: 40,
        updatedAt: "2026-07-27T10:00:00.000Z",
      }),
    });
    await expect(
      new LeadConversionService(data).changePipelineStage(
        {
          opportunityId,
          expectedUpdatedAt: version,
          pipelineStage: "discussion",
        },
        representative,
      ),
    ).resolves.toMatchObject({ status: "already_applied" });
    expect(data.changePipelineStage).not.toHaveBeenCalled();
  });

  it("rejects a stale request whose intended state is not authoritative", async () => {
    const data = repository({
      getById: vi.fn().mockResolvedValue({
        ...opportunity,
        pipelineStage: "quotation_sent",
        probabilityPercent: 60,
        updatedAt: "2026-07-27T10:00:00.000Z",
      }),
    });
    await expect(
      new LeadConversionService(data).changePipelineStage(
        {
          opportunityId,
          expectedUpdatedAt: version,
          pipelineStage: "discussion",
        },
        representative,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationConflictError);
    expect(data.changePipelineStage).not.toHaveBeenCalled();
  });

  it("resolves a lost same-intent CAS race as already_applied", async () => {
    const final = {
      ...opportunity,
      pipelineStage: "discussion" as const,
      probabilityPercent: 40,
      updatedAt: "2026-07-27T10:00:00.000Z",
    };
    const data = repository({
      getById: vi
        .fn()
        .mockResolvedValueOnce(opportunity)
        .mockResolvedValueOnce(final),
      changePipelineStage: vi.fn().mockResolvedValue(null),
    });
    await expect(
      new LeadConversionService(data).changePipelineStage(
        {
          opportunityId,
          expectedUpdatedAt: version,
          pipelineStage: "discussion",
        },
        representative,
      ),
    ).resolves.toEqual({ status: "already_applied", opportunity: final });
  });

  it("returns conflict when a different concurrent mutation wins", async () => {
    const data = repository({
      getById: vi
        .fn()
        .mockResolvedValueOnce(opportunity)
        .mockResolvedValueOnce({
          ...opportunity,
          pipelineStage: "quotation_sent",
          probabilityPercent: 60,
          updatedAt: "2026-07-27T10:00:00.000Z",
        }),
      changePipelineStage: vi.fn().mockResolvedValue(null),
    });
    await expect(
      new LeadConversionService(data).changePipelineStage(
        {
          opportunityId,
          expectedUpdatedAt: version,
          pipelineStage: "discussion",
        },
        representative,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationConflictError);
  });

  it("uses dedicated terminal workflows and exact Lost replay details", async () => {
    const wonData = repository({
      getById: vi.fn().mockResolvedValue(opportunity),
    });
    await expect(
      new LeadConversionService(wonData).markWon(
        { opportunityId, expectedUpdatedAt: version },
        representative,
      ),
    ).resolves.toMatchObject({
      status: "applied",
      opportunity: { pipelineStage: "won", probabilityPercent: 100 },
    });

    const lost = {
      ...opportunity,
      pipelineStage: "lost" as const,
      probabilityPercent: 0,
      lostAt: "2026-07-27T10:00:00.000Z",
      lostReason: "other" as const,
      lostReasonNotes: "Client changed direction",
    };
    const lostData = repository({
      getById: vi.fn().mockResolvedValue(lost),
    });
    await expect(
      new LeadConversionService(lostData).markLost(
        {
          opportunityId,
          expectedUpdatedAt: version,
          lostReason: "other",
          lostReasonNotes: "  Client changed direction  ",
        },
        manager,
      ),
    ).resolves.toMatchObject({ status: "already_applied" });
    await expect(
      new LeadConversionService(lostData).markLost(
        {
          opportunityId,
          expectedUpdatedAt: lost.updatedAt,
          lostReason: "budget",
          lostReasonNotes: null,
        },
        manager,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationEligibilityError);
  });

  it("does not grant mutation through Company-derived read access", async () => {
    const data = repository({
      getById: vi.fn().mockResolvedValue(opportunity),
      canModifyLead: vi.fn().mockResolvedValue(false),
    });
    await expect(
      new LeadConversionService(data).markWon(
        { opportunityId, expectedUpdatedAt: version },
        representative,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationPermissionError);
    expect(data.markWon).not.toHaveBeenCalled();
  });

  it("maps inaccessible, inactive and unknown failures safely", async () => {
    const missing = repository({
      getById: vi.fn().mockResolvedValue(null),
    });
    await expect(
      new LeadConversionService(missing).markWon(
        { opportunityId, expectedUpdatedAt: version },
        manager,
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationNotFoundError);

    const inactive = repository();
    await expect(
      new LeadConversionService(inactive).markWon(
        { opportunityId, expectedUpdatedAt: version },
        { ...representative, isActive: false },
      ),
    ).rejects.toBeInstanceOf(OpportunityMutationPermissionError);
    expect(inactive.getById).not.toHaveBeenCalled();

    const unavailable = repository({
      getById: vi.fn().mockRejectedValue(
        new OpportunityRepositoryError(
          "get by id",
          "unknown",
          new Error("raw SQL secret"),
        ),
      ),
    });
    const error = await new LeadConversionService(unavailable)
      .markWon({ opportunityId, expectedUpdatedAt: version }, manager)
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(OpportunityMutationUnavailableError);
    expect((error as Error).message).not.toContain("secret");
  });
});
