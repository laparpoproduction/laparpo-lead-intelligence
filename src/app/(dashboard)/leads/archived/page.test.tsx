import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@/lib/leads/lead.types";
import { LEADS_DEFAULT_PAGE_SIZE } from "@/lib/leads/lead-ui";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireDashboardUser: vi.fn(),
  createLeadMutationContext: vi.fn(),
  listArchived: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({
  requireDashboardUser: mocks.requireDashboardUser,
}));
vi.mock("@/lib/leads/lead.server", () => ({
  createLeadMutationContext: mocks.createLeadMutationContext,
}));

import ArchivedLeadsPage from "./page";

const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  role: "sales_manager" as const,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`redirect:${href}`);
  });
  mocks.requireDashboardUser.mockResolvedValue({
    id: actor.userId,
    role: actor.role,
    demoMode: false,
  });
  mocks.createLeadMutationContext.mockResolvedValue({
    actor,
    service: { listArchived: mocks.listArchived },
  });
  mocks.listArchived.mockResolvedValue({
    items: [] as Lead[],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
});

describe("Archived Leads page", () => {
  it("keeps route access management-only and uses server-driven query options", async () => {
    await ArchivedLeadsPage({
      searchParams: Promise.resolve({
        q: "campaign",
        leadStatus: "closed",
        sortBy: "expectedCloseDate",
        sortDirection: "asc",
      }),
    });

    expect(mocks.requireDashboardUser).toHaveBeenCalledWith({
      allowedRoles: ["ceo_admin", "sales_manager"],
    });
    expect(mocks.listArchived).toHaveBeenCalledWith(
      {
        query: "campaign",
        companyId: undefined,
        assignedTo: undefined,
        stage: undefined,
        leadStatus: "closed",
        qualificationStatus: undefined,
        priority: undefined,
        sortBy: "expectedCloseDate",
        sortDirection: "asc",
        page: 1,
        pageSize: LEADS_DEFAULT_PAGE_SIZE,
      },
      actor,
    );
  });

  it("rejects includeDeleted and malformed query values before data access", async () => {
    await expect(
      ArchivedLeadsPage({
        searchParams: Promise.resolve({
          includeDeleted: "true",
          assignedTo: "another-user",
        }),
      }),
    ).rejects.toThrow("redirect:/leads/archived");

    expect(mocks.requireDashboardUser).not.toHaveBeenCalled();
    expect(mocks.listArchived).not.toHaveBeenCalled();
  });

  it("preserves archived filters when correcting an out-of-range page", async () => {
    mocks.listArchived.mockResolvedValueOnce({
      items: [],
      page: 9,
      pageSize: 25,
      total: 26,
      totalPages: 2,
    });

    await expect(
      ArchivedLeadsPage({
        searchParams: Promise.resolve({
          stage: "lost",
          page: "9",
        }),
      }),
    ).rejects.toThrow("redirect:/leads/archived?stage=lost&page=2");
  });
});
