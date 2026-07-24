import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadNotFoundError } from "@/lib/leads/lead.service";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
  requireDashboardUser: vi.fn(),
  createLeadMutationContext: vi.fn(),
  createLeadActivityMutationContext: vi.fn(),
  getById: vi.fn(),
  listArchivedByLead: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/lib/auth/session", () => ({
  requireDashboardUser: mocks.requireDashboardUser,
}));
vi.mock("@/lib/leads/lead.server", () => ({
  createLeadMutationContext: mocks.createLeadMutationContext,
}));
vi.mock("@/lib/lead-activities/lead-activity.server", () => ({
  createLeadActivityMutationContext: mocks.createLeadActivityMutationContext,
}));

import ArchivedLeadActivitiesPage from "./page";

const leadId = "11111111-1111-4111-8111-111111111111";
const actor = {
  userId: "22222222-2222-4222-8222-222222222222",
  role: "sales_manager",
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("not-found");
  });
  mocks.requireDashboardUser.mockResolvedValue({
    demoMode: false,
    role: "sales_manager",
  });
  mocks.getById.mockResolvedValue({ id: leadId, title: "Campaign lead" });
  mocks.createLeadMutationContext.mockResolvedValue({
    actor,
    service: { getById: mocks.getById },
  });
  mocks.listArchivedByLead.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  mocks.createLeadActivityMutationContext.mockResolvedValue({
    actor,
    service: { listArchivedByLead: mocks.listArchivedByLead },
  });
});

describe("Archived Lead activities page", () => {
  it("requires a management role before inspecting archived data", async () => {
    await ArchivedLeadActivitiesPage({
      params: Promise.resolve({ leadId }),
    });
    expect(mocks.requireDashboardUser).toHaveBeenCalledWith({
      allowedRoles: ["ceo_admin", "sales_manager"],
    });
    expect(mocks.listArchivedByLead).toHaveBeenCalledWith(
      leadId,
      { page: 1, pageSize: 25, sortDirection: "desc" },
      actor,
    );
  });

  it("keeps archived retrieval scoped and paginated for the current Lead", async () => {
    await ArchivedLeadActivitiesPage({
      params: Promise.resolve({ leadId }),
      searchParams: Promise.resolve({ page: "3" }),
    });
    expect(mocks.listArchivedByLead).toHaveBeenCalledWith(
      leadId,
      { page: 3, pageSize: 25, sortDirection: "desc" },
      actor,
    );
  });

  it("maps a missing parent Lead to the route not-found state", async () => {
    mocks.getById.mockRejectedValueOnce(new LeadNotFoundError());
    await expect(
      ArchivedLeadActivitiesPage({
        params: Promise.resolve({ leadId }),
      }),
    ).rejects.toThrow("not-found");
    expect(mocks.listArchivedByLead).not.toHaveBeenCalled();
  });
});
