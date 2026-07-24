import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@/lib/leads/lead.types";
import { LEADS_DEFAULT_PAGE_SIZE } from "@/lib/leads/lead-ui";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireDashboardUser: vi.fn(),
  createLeadMutationContext: vi.fn(),
  list: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({ requireDashboardUser: mocks.requireDashboardUser }));
vi.mock("@/lib/leads/lead.server", () => ({ createLeadMutationContext: mocks.createLeadMutationContext }));

import LeadsPage from "./page";

const actor = { userId: "11111111-1111-4111-8111-111111111111", role: "sales_manager" as const, isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((href: string) => { throw new Error(`redirect:${href}`); });
  mocks.requireDashboardUser.mockResolvedValue({ id: actor.userId, role: actor.role, demoMode: false });
  mocks.createLeadMutationContext.mockResolvedValue({ actor, service: { list: mocks.list } });
  mocks.list.mockResolvedValue({ items: [] as Lead[], page: 1, pageSize: 25, total: 0, totalPages: 0 });
});

describe("Leads list page", () => {
  it("requests the bounded CRM list ordered by latest update", async () => {
    mocks.list.mockResolvedValueOnce({ items: [], page: 2, pageSize: 25, total: 30, totalPages: 2 });
    await LeadsPage({ searchParams: Promise.resolve({ page: "2" }) });
    expect(mocks.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: LEADS_DEFAULT_PAGE_SIZE,
      sortBy: "updatedAt",
      sortDirection: "desc",
    }, actor);
  });

  it("normalizes invalid and out-of-range pages", async () => {
    await expect(LeadsPage({ searchParams: Promise.resolve({ page: "unsafe" }) })).rejects.toThrow("redirect:/leads");
    expect(mocks.list).not.toHaveBeenCalled();

    mocks.list.mockResolvedValueOnce({ items: [], page: 9, pageSize: 25, total: 30, totalPages: 2 });
    await expect(LeadsPage({ searchParams: Promise.resolve({ page: "9" }) })).rejects.toThrow("redirect:/leads?page=2");
  });

  it("renders the preview empty state without a Supabase context", async () => {
    mocks.requireDashboardUser.mockResolvedValueOnce({ id: "demo-user", role: "ceo_admin", demoMode: true });
    expect(await LeadsPage({ searchParams: Promise.resolve({}) })).toBeDefined();
    expect(mocks.createLeadMutationContext).not.toHaveBeenCalled();
  });
});
