import { describe, expect, it } from "vitest";
import {
  buildCompaniesHref,
  clearCompanyFiltersHref,
  getCompanyResultRange,
  isCanonicalCompanyQuery,
  parseCompanyQueryState,
  toCompanyListOptions,
} from "./company-query";
import { COMPANIES_DEFAULT_PAGE_SIZE } from "./company.constants";

describe("company list query state", () => {
  it("parses and trims supported search parameters", () => {
    expect(
      parseCompanyQueryState({
        q: "  Acme Malaysia  ",
        companyType: "fnb",
        industry: "  Food & Beverage ",
        city: " George Town ",
        state: " Penang ",
        sortBy: "displayName",
        sortDirection: "asc",
        page: "3",
      }),
    ).toEqual({
      q: "Acme Malaysia",
      companyType: "fnb",
      industry: "Food & Beverage",
      city: "George Town",
      state: "Penang",
      sortBy: "displayName",
      sortDirection: "asc",
      page: 3,
    });
  });

  it("falls back safely for invalid values", () => {
    expect(
      parseCompanyQueryState({
        companyType: "private",
        sortBy: "fingerprint",
        sortDirection: "sideways",
        page: "-8",
      }),
    ).toEqual({
      q: undefined,
      companyType: undefined,
      industry: undefined,
      city: undefined,
      state: undefined,
      sortBy: "createdAt",
      sortDirection: "desc",
      page: 1,
    });
  });

  it("removes empty values and canonical defaults", () => {
    const query = parseCompanyQueryState({
      q: "   ",
      industry: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      page: "1",
    });
    expect(buildCompaniesHref(query)).toBe("/companies");
    expect(
      isCanonicalCompanyQuery(
        {
          q: "   ",
          industry: "",
          sortBy: "createdAt",
          sortDirection: "desc",
          page: "1",
        },
        query,
      ),
    ).toBe(false);
  });

  it("maps every search and filter field into bounded service options", () => {
    const query = parseCompanyQueryState({
      q: "Acme",
      companyType: "agency",
      industry: "Advertising",
      city: "Bayan Lepas",
      state: "Penang",
      sortBy: "updatedAt",
      sortDirection: "asc",
      page: "2",
    });

    expect(toCompanyListOptions(query, COMPANIES_DEFAULT_PAGE_SIZE)).toEqual({
      query: "Acme",
      companyType: "agency",
      industry: "Advertising",
      city: "Bayan Lepas",
      state: "Penang",
      sortBy: "updatedAt",
      sortDirection: "asc",
      page: 2,
      pageSize: 25,
    });
  });

  it("preserves active state while changing pages", () => {
    const query = parseCompanyQueryState({
      q: "Acme",
      companyType: "hotel",
      sortBy: "legalName",
      sortDirection: "asc",
    });

    expect(buildCompaniesHref(query, { page: 2 })).toBe(
      "/companies?q=Acme&companyType=hotel&sortBy=legalName&sortDirection=asc&page=2",
    );
  });

  it("clears search filters while preserving sorting", () => {
    const query = parseCompanyQueryState({
      q: "Acme",
      city: "Ipoh",
      sortBy: "displayName",
      sortDirection: "asc",
      page: "4",
    });

    expect(clearCompanyFiltersHref(query)).toBe(
      "/companies?sortBy=displayName&sortDirection=asc",
    );
  });

  it("calculates first, middle, final and empty result ranges", () => {
    expect(getCompanyResultRange(1, 25, 124)).toEqual({ first: 1, last: 25 });
    expect(getCompanyResultRange(2, 25, 124)).toEqual({ first: 26, last: 50 });
    expect(getCompanyResultRange(5, 25, 124)).toEqual({ first: 101, last: 124 });
    expect(getCompanyResultRange(1, 25, 0)).toEqual({ first: 0, last: 0 });
  });
});
