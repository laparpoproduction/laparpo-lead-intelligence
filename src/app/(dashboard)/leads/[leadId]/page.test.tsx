import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadNotFoundError } from "@/lib/leads/lead.service";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  requireDashboardUser: vi.fn(),
  createLeadMutationContext: vi.fn(),
  getById: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/auth/session", () => ({ requireDashboardUser: mocks.requireDashboardUser }));
vi.mock("@/lib/leads/lead.server", () => ({ createLeadMutationContext: mocks.createLeadMutationContext }));

import LeadDetailsPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => { throw new Error("not-found"); });
  mocks.requireDashboardUser.mockResolvedValue({ demoMode: false });
  mocks.createLeadMutationContext.mockResolvedValue({
    actor: { userId: "11111111-1111-4111-8111-111111111111", role: "sales_manager", isActive: true },
    service: { getById: mocks.getById },
  });
});

describe("Lead details page", () => {
  it("maps a missing Lead to the route not-found boundary", async () => {
    mocks.getById.mockRejectedValueOnce(new LeadNotFoundError());
    await expect(LeadDetailsPage({ params: Promise.resolve({ leadId: "22222222-2222-4222-8222-222222222222" }) })).rejects.toThrow("not-found");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
