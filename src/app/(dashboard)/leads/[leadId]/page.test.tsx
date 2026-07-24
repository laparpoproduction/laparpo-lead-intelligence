import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadNotFoundError } from "@/lib/leads/lead.service";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
  requireDashboardUser: vi.fn(),
  createLeadMutationContext: vi.fn(),
  createLeadActivityMutationContext: vi.fn(),
  getById: vi.fn(),
  listByLead: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/lib/auth/session", () => ({ requireDashboardUser: mocks.requireDashboardUser }));
vi.mock("@/lib/leads/lead.server", () => ({ createLeadMutationContext: mocks.createLeadMutationContext }));
vi.mock("@/lib/lead-activities/lead-activity.server", () => ({
  createLeadActivityMutationContext: mocks.createLeadActivityMutationContext,
}));

import LeadDetailsPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => { throw new Error("not-found"); });
  mocks.requireDashboardUser.mockResolvedValue({ demoMode: false });
  mocks.createLeadMutationContext.mockResolvedValue({
    actor: { userId: "11111111-1111-4111-8111-111111111111", role: "sales_manager", isActive: true },
    service: { getById: mocks.getById },
  });
  mocks.getById.mockResolvedValue({
    id: "22222222-2222-4222-8222-222222222222",
    title: "Campaign lead",
  });
  mocks.listByLead.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  mocks.createLeadActivityMutationContext.mockResolvedValue({
    actor: { userId: "11111111-1111-4111-8111-111111111111", role: "sales_manager", isActive: true },
    service: { listByLead: mocks.listByLead },
  });
});

describe("Lead details page", () => {
  it("maps a missing Lead to the route not-found boundary", async () => {
    mocks.getById.mockRejectedValueOnce(new LeadNotFoundError());
    await expect(LeadDetailsPage({ params: Promise.resolve({ leadId: "22222222-2222-4222-8222-222222222222" }) })).rejects.toThrow("not-found");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("retrieves only the current Lead timeline in newest-first pages", async () => {
    await LeadDetailsPage({
      params: Promise.resolve({
        leadId: "22222222-2222-4222-8222-222222222222",
      }),
      searchParams: Promise.resolve({ activityPage: "2" }),
    });
    expect(mocks.listByLead).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      { page: 2, pageSize: 25, sortDirection: "desc" },
      expect.objectContaining({ role: "sales_manager" }),
    );
  });

  it("keeps the Lead detail available with a polished activity load error", async () => {
    mocks.listByLead.mockRejectedValueOnce(new Error("database secret"));
    const result = await LeadDetailsPage({
      params: Promise.resolve({
        leadId: "22222222-2222-4222-8222-222222222222",
      }),
    });
    expect(result).toBeDefined();
  });
});
