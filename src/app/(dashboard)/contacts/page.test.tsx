import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assigneeId,
  companyId,
  contactFixture,
  creatorId,
} from "@/lib/contacts/contact.test-fixtures";
import { CONTACTS_DEFAULT_PAGE_SIZE } from "@/lib/contacts/contact.validation";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireDashboardUser: vi.fn(),
  serviceSearch: vi.fn(),
  createContactMutationContext: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
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
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`redirect:${href}`);
  });
  mocks.requireDashboardUser.mockResolvedValue({
    id: creatorId,
    fullName: "Sales Manager",
    email: "manager@example.my",
    role: "sales_manager",
    demoMode: false,
  });
  mocks.createContactMutationContext.mockResolvedValue({
    actor,
    service: { search: mocks.serviceSearch },
  });
  mocks.serviceSearch.mockResolvedValue({
    items: [contactFixture],
    page: 1,
    pageSize: CONTACTS_DEFAULT_PAGE_SIZE,
    total: 1,
    totalPages: 1,
  });
});

describe("Contacts list page", () => {
  it("passes search, every filter, sorting and pagination to ContactService", async () => {
    mocks.serviceSearch.mockResolvedValueOnce({
      items: [contactFixture],
      page: 2,
      pageSize: 25,
      total: 40,
      totalPages: 2,
    });
    await ContactsPage({
      searchParams: Promise.resolve({
        q: "Aisyah",
        companyId,
        assignedTo: assigneeId,
        createdBy: creatorId,
        contactStatus: "verified",
        isPrimaryContact: "false",
        sortBy: "fullName",
        sortDirection: "asc",
        page: "2",
      }),
    });

    expect(mocks.serviceSearch).toHaveBeenCalledWith(
      {
        query: "Aisyah",
        companyId,
        assignedTo: assigneeId,
        createdBy: creatorId,
        contactStatus: "verified",
        isPrimaryContact: false,
        page: 2,
        pageSize: 25,
        sortBy: "fullName",
        sortDirection: "asc",
      },
      actor,
    );
  });

  it("normalizes a page beyond the final result page", async () => {
    mocks.serviceSearch.mockResolvedValueOnce({
      items: [],
      page: 9,
      pageSize: 25,
      total: 40,
      totalPages: 2,
    });

    await expect(
      ContactsPage({
        searchParams: Promise.resolve({ q: "Aisyah", page: "9" }),
      }),
    ).rejects.toThrow("redirect:/contacts?q=Aisyah&page=2");
  });

  it("canonicalizes invalid parameters before querying the service", async () => {
    await expect(
      ContactsPage({
        searchParams: Promise.resolve({
          q: " ",
          companyId: "invalid",
          contactStatus: "unknown",
          isPrimaryContact: "maybe",
          sortBy: "unsafe",
          sortDirection: "sideways",
          page: "0",
        }),
      }),
    ).rejects.toThrow("redirect:/contacts");

    expect(mocks.serviceSearch).not.toHaveBeenCalled();
  });

  it("uses the empty preview without creating a Supabase read context", async () => {
    mocks.requireDashboardUser.mockResolvedValueOnce({
      id: "demo-user",
      fullName: "Laparpo",
      email: "preview@laparpo.com",
      role: "ceo_admin",
      demoMode: true,
    });

    const page = await ContactsPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
    expect(mocks.createContactMutationContext).not.toHaveBeenCalled();
  });
});
