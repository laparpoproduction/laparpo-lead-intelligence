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
} from "./opportunity.service";

const leadId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";
const manager = {
  userId: "33333333-3333-4333-8333-333333333333",
  role: "sales_manager" as const,
  isActive: true,
};
const representative = {
  ...manager,
  role: "sales_representative" as const,
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
});
