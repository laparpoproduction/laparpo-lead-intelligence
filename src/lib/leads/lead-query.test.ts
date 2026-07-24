import { describe, expect, it } from "vitest";
import {
  buildLeadsHref,
  clearLeadFiltersHref,
  getLeadResultRange,
  isCanonicalLeadQuery,
  parseLeadQueryState,
  toLeadListOptions,
} from "./lead-query";
import { LEADS_DEFAULT_PAGE_SIZE } from "./lead-ui";

const companyId = "11111111-1111-4111-8111-111111111111";
const assigneeId = "22222222-2222-4222-8222-222222222222";

describe("lead list query state", () => {
  it("provides stable defaults", () => {
    expect(parseLeadQueryState({})).toEqual({
      q: undefined,
      companyId: undefined,
      assignedTo: undefined,
      stage: undefined,
      leadStatus: undefined,
      qualificationStatus: undefined,
      priority: undefined,
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
  });

  it("trims search and parses every supported filter", () => {
    expect(
      parseLeadQueryState({
        q: "  festive campaign  ",
        companyId,
        assignedTo: assigneeId,
        stage: "negotiation",
        leadStatus: "active",
        qualificationStatus: "qualified",
        priority: "urgent",
        sortBy: "expectedCloseDate",
        sortDirection: "asc",
        page: "3",
      }),
    ).toEqual({
      q: "festive campaign",
      companyId,
      assignedTo: assigneeId,
      stage: "negotiation",
      leadStatus: "active",
      qualificationStatus: "qualified",
      priority: "urgent",
      sortBy: "expectedCloseDate",
      sortDirection: "asc",
      page: 3,
    });
  });

  it("falls back safely for invalid and security-sensitive values", () => {
    const query = parseLeadQueryState({
      q: "   ",
      companyId: "not-a-uuid",
      assignedTo: "invalid",
      stage: "deleted",
      leadStatus: "won",
      qualificationStatus: "approved",
      priority: "critical",
      sortBy: "fingerprint",
      sortDirection: "sideways",
      page: "-3",
      includeDeleted: "true",
    });

    expect(query).toEqual({
      q: undefined,
      companyId: undefined,
      assignedTo: undefined,
      stage: undefined,
      leadStatus: undefined,
      qualificationStatus: undefined,
      priority: undefined,
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
    });
    expect(buildLeadsHref(query)).toBe("/leads");
    expect(isCanonicalLeadQuery({ includeDeleted: "true" }, query)).toBe(false);
  });

  it("maps combined search, filters, sorting and page into bounded options", () => {
    const query = parseLeadQueryState({
      q: "video",
      companyId,
      assignedTo: assigneeId,
      stage: "quotation_sent",
      leadStatus: "paused",
      qualificationStatus: "potentially_qualified",
      priority: "high",
      sortBy: "nextFollowUpAt",
      sortDirection: "asc",
      page: "2",
    });

    expect(toLeadListOptions(query, LEADS_DEFAULT_PAGE_SIZE)).toEqual({
      query: "video",
      companyId,
      assignedTo: assigneeId,
      stage: "quotation_sent",
      leadStatus: "paused",
      qualificationStatus: "potentially_qualified",
      priority: "high",
      sortBy: "nextFollowUpAt",
      sortDirection: "asc",
      page: 2,
      pageSize: 25,
    });
  });

  it("preserves query state across active and archived pagination", () => {
    const query = parseLeadQueryState({
      q: "Domino",
      stage: "qualified",
      priority: "high",
      sortBy: "title",
      sortDirection: "asc",
    });

    const search =
      "q=Domino&stage=qualified&priority=high&sortBy=title&sortDirection=asc&page=2";
    expect(buildLeadsHref(query, { page: 2 })).toBe(`/leads?${search}`);
    expect(buildLeadsHref(query, { page: 2 }, true)).toBe(
      `/leads/archived?${search}`,
    );
  });

  it("resets page for changed search, filter and sort submissions", () => {
    const current = parseLeadQueryState({
      q: "old",
      stage: "new",
      sortBy: "createdAt",
      page: "9",
    });
    const submitted = parseLeadQueryState({
      q: "new campaign",
      stage: "contacted",
      sortBy: "priority",
      sortDirection: "asc",
    });

    expect(buildLeadsHref(submitted, { page: 1 })).toBe(
      "/leads?q=new+campaign&stage=contacted&sortBy=priority&sortDirection=asc",
    );
    expect(current.page).toBe(9);
  });

  it("clears filters while retaining safe sorting", () => {
    const query = parseLeadQueryState({
      q: "campaign",
      companyId,
      assignedTo: assigneeId,
      stage: "qualified",
      leadStatus: "active",
      qualificationStatus: "qualified",
      priority: "urgent",
      sortBy: "title",
      sortDirection: "asc",
      page: "8",
    });

    expect(clearLeadFiltersHref(query)).toBe(
      "/leads?sortBy=title&sortDirection=asc",
    );
    expect(clearLeadFiltersHref(query, true)).toBe(
      "/leads/archived?sortBy=title&sortDirection=asc",
    );
  });

  it("calculates current result ranges", () => {
    expect(getLeadResultRange(1, 25, 124)).toEqual({ first: 1, last: 25 });
    expect(getLeadResultRange(2, 25, 124)).toEqual({ first: 26, last: 50 });
    expect(getLeadResultRange(5, 25, 124)).toEqual({
      first: 101,
      last: 124,
    });
    expect(getLeadResultRange(1, 25, 0)).toEqual({ first: 0, last: 0 });
  });
});
