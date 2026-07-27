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
    getById: vi.fn().mockResolvedValue(null),
    listByLead: vi.fn().mockResolvedValue([]),
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
});
