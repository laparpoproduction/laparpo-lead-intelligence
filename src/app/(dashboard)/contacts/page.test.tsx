import { beforeEach, describe, expect, it, vi } from "vitest";
import { contactFixture, creatorId } from "@/lib/contacts/contact.test-fixtures";
import { CONTACTS_DEFAULT_PAGE_SIZE } from "@/lib/contacts/contact.validation";

const mocks = vi.hoisted(() => ({
  requireDashboardUser: vi.fn(),
  serviceList: vi.fn(),
  createContactMutationContext: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireDashboardUser: mocks.requireDashboardUser,
}));
vi.mock("@/lib/contacts/contact.server", () => ({
  createContactMutationContext: mocks.createContactMutationContext,
}));

import ContactsPage from "./page";

const actor = {
  userId: creatorId,
  role: "sales_manager" as const,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireDashboardUser.mockResolvedValue({
    id: creatorId,
    fullName: "Sales Manager",
    email: "manager@example.my",
    role: "sales_manager",
    demoMode: false,
  });
  mocks.createContactMutationContext.mockResolvedValue({
    actor,
    service: { list: mocks.serviceList },
  });
  mocks.serviceList.mockResolvedValue({
    items: [contactFixture],
    page: 1,
    pageSize: CONTACTS_DEFAULT_PAGE_SIZE,
    total: 1,
    totalPages: 1,
  });
});

describe("Contacts list page", () => {
  it("loads only the deterministic bounded first page through ContactService", async () => {
    await ContactsPage();

    expect(mocks.serviceList).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 25,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
      actor,
    );
  });

  it("uses the empty preview without creating a Supabase read context", async () => {
    mocks.requireDashboardUser.mockResolvedValueOnce({
      id: "demo-user",
      fullName: "Laparpo",
      email: "preview@laparpo.com",
      role: "ceo_admin",
      demoMode: true,
    });

    const page = await ContactsPage();
    expect(page).toBeDefined();
    expect(mocks.createContactMutationContext).not.toHaveBeenCalled();
  });
});
