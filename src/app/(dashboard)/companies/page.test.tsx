import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyFixture, userId } from "@/lib/companies/company.test-fixtures";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireDashboardUser: vi.fn(),
  serviceSearch: vi.fn(),
  createCompanyMutationContext: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({
  requireDashboardUser: mocks.requireDashboardUser,
}));
vi.mock("@/lib/companies/company.server", () => ({
  createCompanyMutationContext: mocks.createCompanyMutationContext,
}));

import CompaniesPage from "./page";

const actor = {
  userId,
  role: "sales_manager" as const,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`redirect:${href}`);
  });
  mocks.requireDashboardUser.mockResolvedValue({
    id: userId,
    fullName: "Sales Manager",
    email: "manager@example.my",
    role: "sales_manager",
    demoMode: false,
  });
  mocks.createCompanyMutationContext.mockResolvedValue({
    actor,
    service: { search: mocks.serviceSearch },
  });
  mocks.serviceSearch.mockResolvedValue({
    items: [companyFixture],
    page: 2,
    pageSize: 25,
    total: 40,
    totalPages: 2,
  });
});

describe("Companies list page", () => {
  it("passes search, filters, sorting and pagination to CompanyService", async () => {
    await CompaniesPage({
      searchParams: Promise.resolve({
        q: "Acme",
        companyType: "agency",
        industry: "Advertising",
        city: "Bayan Lepas",
        state: "Penang",
        sortBy: "legalName",
        sortDirection: "asc",
        page: "2",
      }),
    });

    expect(mocks.serviceSearch).toHaveBeenCalledWith(
      {
        query: "Acme",
        companyType: "agency",
        industry: "Advertising",
        city: "Bayan Lepas",
        state: "Penang",
        sortBy: "legalName",
        sortDirection: "asc",
        page: 2,
        pageSize: 25,
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
      CompaniesPage({ searchParams: Promise.resolve({ q: "Acme", page: "9" }) }),
    ).rejects.toThrow("redirect:/companies?q=Acme&page=2");
  });

  it("canonicalizes invalid parameters before querying the service", async () => {
    await expect(
      CompaniesPage({
        searchParams: Promise.resolve({
          q: " ",
          sortBy: "unsafe",
          sortDirection: "sideways",
          page: "0",
        }),
      }),
    ).rejects.toThrow("redirect:/companies");

    expect(mocks.serviceSearch).not.toHaveBeenCalled();
  });
});
