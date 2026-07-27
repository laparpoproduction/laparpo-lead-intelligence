import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPPORTUNITIES_DEFAULT_PAGE_SIZE } from "@/lib/opportunities/opportunity-ui";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireDashboardUser: vi.fn(),
  createOpportunityContext: vi.fn(),
  list: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({
  requireDashboardUser: mocks.requireDashboardUser,
}));
vi.mock("@/lib/opportunities/opportunity.server", () => ({
  createOpportunityContext: mocks.createOpportunityContext,
}));

import OpportunitiesPage from "./page";

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
  mocks.createOpportunityContext.mockResolvedValue({
    actor,
    service: { list: mocks.list },
  });
  mocks.list.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
});

describe("Opportunities list page", () => {
  it("requests the typed server-driven list", async () => {
    mocks.list.mockResolvedValueOnce({
      items: [],
      page: 2,
      pageSize: 25,
      total: 28,
      totalPages: 2,
    });
    await OpportunitiesPage({
      searchParams: Promise.resolve({
        q: "Domino's",
        service: "hard_selling",
        kind: "conversion",
        sort: "value_desc",
        page: "2",
      }),
    });
    expect(mocks.list).toHaveBeenCalledWith(
      {
        query: "Domino's",
        service: "hard_selling",
        kind: "conversion",
        sort: "value_desc",
        page: 2,
        pageSize: OPPORTUNITIES_DEFAULT_PAGE_SIZE,
      },
      actor,
    );
  });

  it("canonicalizes malformed and out-of-range pages before unsafe offsets", async () => {
    await expect(
      OpportunitiesPage({
        searchParams: Promise.resolve({ page: "1; drop table" }),
      }),
    ).rejects.toThrow("redirect:/opportunities");
    expect(mocks.list).not.toHaveBeenCalled();

    mocks.list.mockResolvedValueOnce({
      items: [],
      page: 9,
      pageSize: 25,
      total: 40,
      totalPages: 2,
    });
    await expect(
      OpportunitiesPage({
        searchParams: Promise.resolve({
          q: "agency",
          kind: "ordinary",
          page: "9",
        }),
      }),
    ).rejects.toThrow(
      "redirect:/opportunities?q=agency&kind=ordinary&page=2",
    );
  });

  it("removes unsupported and duplicate query state", async () => {
    await expect(
      OpportunitiesPage({
        searchParams: Promise.resolve({
          service: "future_service",
          kind: ["conversion", "ordinary"],
          arbitrarySql: "true",
        }),
      }),
    ).rejects.toThrow("redirect:/opportunities?kind=conversion");
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("renders demo empty state without a database context", async () => {
    mocks.requireDashboardUser.mockResolvedValueOnce({
      id: "demo",
      role: "ceo_admin",
      demoMode: true,
    });
    expect(
      await OpportunitiesPage({ searchParams: Promise.resolve({}) }),
    ).toBeDefined();
    expect(mocks.createOpportunityContext).not.toHaveBeenCalled();
  });
});
