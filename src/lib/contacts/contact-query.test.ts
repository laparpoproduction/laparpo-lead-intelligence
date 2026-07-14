import { describe, expect, it } from "vitest";
import {
  buildContactsHref,
  clearContactFiltersHref,
  getContactResultRange,
  isCanonicalContactQuery,
  parseContactQueryState,
  toContactListOptions,
} from "./contact-query";
import {
  assigneeId,
  companyId,
  creatorId,
} from "./contact.test-fixtures";
import { CONTACTS_DEFAULT_PAGE_SIZE } from "./contact.validation";

describe("contact list query state", () => {
  it("provides stable defaults", () => {
    expect(parseContactQueryState({})).toEqual({
      q: undefined,
      companyId: undefined,
      assignedTo: undefined,
      createdBy: undefined,
      contactStatus: undefined,
      isPrimaryContact: undefined,
      sortBy: "createdAt",
      sortDirection: "desc",
      page: 1,
    });
  });

  it("trims search and parses every supported filter", () => {
    expect(
      parseContactQueryState({
        q: "  Aisyah manager  ",
        companyId,
        assignedTo: assigneeId,
        createdBy: creatorId,
        contactStatus: "verified",
        isPrimaryContact: "true",
        sortBy: "fullName",
        sortDirection: "asc",
        page: "3",
      }),
    ).toEqual({
      q: "Aisyah manager",
      companyId,
      assignedTo: assigneeId,
      createdBy: creatorId,
      contactStatus: "verified",
      isPrimaryContact: true,
      sortBy: "fullName",
      sortDirection: "asc",
      page: 3,
    });
  });

  it("omits empty and invalid values and falls back safely", () => {
    const query = parseContactQueryState({
      q: "   ",
      companyId: "not-a-uuid",
      assignedTo: "invalid",
      createdBy: "also-invalid",
      contactStatus: "new",
      isPrimaryContact: "sometimes",
      sortBy: "workEmail",
      sortDirection: "sideways",
      page: "-3",
    });

    expect(query).toEqual({
      q: undefined,
      companyId: undefined,
      assignedTo: undefined,
      createdBy: undefined,
      contactStatus: undefined,
      isPrimaryContact: undefined,
      sortBy: "createdAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(buildContactsHref(query)).toBe("/contacts");
  });

  it("canonicalizes duplicate parameters deterministically", () => {
    const params = new URLSearchParams();
    params.append("contactStatus", "verified");
    params.append("contactStatus", "qualified");
    params.append("q", " Aisyah ");

    const query = parseContactQueryState(params);
    expect(query.contactStatus).toBe("verified");
    expect(query.q).toBe("Aisyah");
    expect(buildContactsHref(query)).toBe(
      "/contacts?q=Aisyah&contactStatus=verified",
    );
    expect(
      isCanonicalContactQuery(
        { contactStatus: ["verified", "qualified"], q: " Aisyah " },
        query,
      ),
    ).toBe(false);
  });

  it("maps search, filters, sorting and page into bounded service options", () => {
    const query = parseContactQueryState({
      q: "director",
      companyId,
      assignedTo: assigneeId,
      createdBy: creatorId,
      contactStatus: "contacted",
      isPrimaryContact: "false",
      sortBy: "lastVerifiedAt",
      sortDirection: "asc",
      page: "2",
    });

    expect(toContactListOptions(query, CONTACTS_DEFAULT_PAGE_SIZE)).toEqual({
      query: "director",
      companyId,
      assignedTo: assigneeId,
      createdBy: creatorId,
      contactStatus: "contacted",
      isPrimaryContact: false,
      sortBy: "lastVerifiedAt",
      sortDirection: "asc",
      page: 2,
      pageSize: 25,
    });
  });

  it("preserves query state while changing pages and omits page one", () => {
    const query = parseContactQueryState({
      q: "Aisyah",
      contactStatus: "qualified",
      isPrimaryContact: "true",
      sortBy: "jobTitle",
      sortDirection: "asc",
      page: "2",
    });

    expect(buildContactsHref(query, { page: 3 })).toBe(
      "/contacts?q=Aisyah&contactStatus=qualified&isPrimaryContact=true&sortBy=jobTitle&sortDirection=asc&page=3",
    );
    expect(buildContactsHref(query, { page: 1 })).toBe(
      "/contacts?q=Aisyah&contactStatus=qualified&isPrimaryContact=true&sortBy=jobTitle&sortDirection=asc",
    );
  });

  it("clears search filters while retaining safe sorting", () => {
    const query = parseContactQueryState({
      q: "Aisyah",
      companyId,
      assignedTo: assigneeId,
      createdBy: creatorId,
      contactStatus: "verified",
      isPrimaryContact: "false",
      sortBy: "department",
      sortDirection: "asc",
      page: "8",
    });

    expect(clearContactFiltersHref(query)).toBe(
      "/contacts?sortBy=department&sortDirection=asc",
    );
  });

  it("calculates middle, final and empty result ranges", () => {
    expect(getContactResultRange(1, 25, 124)).toEqual({ first: 1, last: 25 });
    expect(getContactResultRange(2, 25, 124)).toEqual({ first: 26, last: 50 });
    expect(getContactResultRange(5, 25, 124)).toEqual({ first: 101, last: 124 });
    expect(getContactResultRange(1, 25, 0)).toEqual({ first: 0, last: 0 });
  });
});
