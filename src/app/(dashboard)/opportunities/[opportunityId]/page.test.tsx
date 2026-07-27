import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  requireDashboardUser: vi.fn(),
  createOpportunityContext: vi.fn(),
  getDetailById: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));
vi.mock("@/lib/auth/session", () => ({
  requireDashboardUser: mocks.requireDashboardUser,
}));
vi.mock("@/lib/opportunities/opportunity.server", () => ({
  createOpportunityContext: mocks.createOpportunityContext,
}));

import OpportunityDetailsPage from "./page";
import {
  OpportunityDetailValidationError,
} from "@/lib/opportunities/opportunity.service";

const opportunityId = "11111111-1111-4111-8111-111111111111";
const actor = {
  userId: "22222222-2222-4222-8222-222222222222",
  role: "sales_manager" as const,
  isActive: true,
};
const detail = {
  id: opportunityId,
  leadId: "33333333-3333-4333-8333-333333333333",
  leadTitle: "Corporate campaign",
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("not-found");
  });
  mocks.requireDashboardUser.mockResolvedValue({
    id: actor.userId,
    role: actor.role,
    demoMode: false,
  });
  mocks.createOpportunityContext.mockResolvedValue({
    actor,
    service: { getDetailById: mocks.getDetailById },
  });
  mocks.getDetailById.mockResolvedValue(detail);
});

describe("Opportunity detail page", () => {
  it("renders an accessible Opportunity returned by the detail service", async () => {
    expect(
      await OpportunityDetailsPage({
        params: Promise.resolve({ opportunityId }),
      }),
    ).toBeDefined();
    expect(mocks.getDetailById).toHaveBeenCalledWith(opportunityId, actor);
  });

  it("treats no-result and inaccessible Opportunities as not found", async () => {
    mocks.getDetailById.mockResolvedValueOnce(null);
    await expect(
      OpportunityDetailsPage({
        params: Promise.resolve({ opportunityId }),
      }),
    ).rejects.toThrow("not-found");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("handles malformed UUIDs with the same safe not-found response", async () => {
    mocks.getDetailById.mockRejectedValueOnce(
      new OpportunityDetailValidationError([]),
    );
    await expect(
      OpportunityDetailsPage({
        params: Promise.resolve({ opportunityId: "malformed" }),
      }),
    ).rejects.toThrow("not-found");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("uses not found in demo mode without creating a database context", async () => {
    mocks.requireDashboardUser.mockResolvedValueOnce({
      id: "demo",
      role: "ceo_admin",
      demoMode: true,
    });
    await expect(
      OpportunityDetailsPage({
        params: Promise.resolve({ opportunityId }),
      }),
    ).rejects.toThrow("not-found");
    expect(mocks.createOpportunityContext).not.toHaveBeenCalled();
  });
});
