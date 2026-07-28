import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOpportunityContext: vi.fn(),
  listPipeline: vi.fn(),
  redirect: vi.fn(),
  requireDashboardUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({
  requireDashboardUser: mocks.requireDashboardUser,
}));
vi.mock("@/lib/opportunities/opportunity.server", () => ({
  createOpportunityContext: mocks.createOpportunityContext,
}));

import OpportunityPipelinePage from "./page";

const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  role: "sales_manager" as const,
  isActive: true,
};
const board = {
  columns: [
    "new",
    "discussion",
    "quotation_sent",
    "negotiation",
    "won",
    "lost",
  ].map((stage) => ({ stage, items: [], total: 0 })),
  ownerProfiles: [],
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
    service: { listPipeline: mocks.listPipeline },
  });
  mocks.listPipeline.mockResolvedValue(board);
});

describe("Opportunity pipeline page", () => {
  it("requests server-driven bounded pipeline data with allow-listed filters", async () => {
    expect(
      await OpportunityPipelinePage({
        searchParams: Promise.resolve({
          q: "Domino's",
          service: "hard_selling",
          kind: "conversion",
        }),
      }),
    ).toBeDefined();
    expect(mocks.listPipeline).toHaveBeenCalledWith(
      {
        query: "Domino's",
        service: "hard_selling",
        kind: "conversion",
      },
      actor,
    );
  });

  it("canonicalizes unsupported and duplicate query values before reads", async () => {
    await expect(
      OpportunityPipelinePage({
        searchParams: Promise.resolve({
          kind: ["ordinary", "conversion"],
          stage: "new",
          sql: "true",
        }),
      }),
    ).rejects.toThrow("redirect:/opportunities/pipeline?kind=ordinary");
    expect(mocks.listPipeline).not.toHaveBeenCalled();
  });

  it("renders all six empty stages in demo mode without database access", async () => {
    mocks.requireDashboardUser.mockResolvedValueOnce({
      id: "demo",
      role: "ceo_admin",
      demoMode: true,
    });
    expect(
      await OpportunityPipelinePage({ searchParams: Promise.resolve({}) }),
    ).toBeDefined();
    expect(mocks.createOpportunityContext).not.toHaveBeenCalled();
  });
});
