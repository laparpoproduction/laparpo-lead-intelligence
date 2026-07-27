import { describe, expect, it } from "vitest";
import {
  buildOpportunitiesHref,
  clearOpportunityFiltersHref,
  getOpportunityResultRange,
  hasOpportunityFilters,
  isCanonicalOpportunityQuery,
  parseOpportunityQueryState,
  toOpportunityListOptions,
} from "./opportunity-query";

describe("Opportunity query state", () => {
  it("uses stable production defaults", () => {
    expect(parseOpportunityQueryState({})).toEqual({
      kind: "all",
      sort: "newest",
      page: 1,
    });
  });

  it("normalizes and trims supported query state", () => {
    expect(
      parseOpportunityQueryState({
        q: "  Domino's  ",
        service: "corporate",
        kind: "conversion",
        stage: "quotation_sent",
        sort: "value_desc",
        page: "3",
      }),
    ).toEqual({
      q: "Domino's",
      service: "corporate",
      kind: "conversion",
      stage: "quotation_sent",
      sort: "value_desc",
      page: 3,
    });
  });

  it("canonicalizes invalid and duplicate input safely", () => {
    const raw = {
      q: ["KFC", "leak"],
      service: "future_status",
      kind: "guessed",
      sort: "raw_sql desc",
      page: "-4",
    };
    const query = parseOpportunityQueryState(raw);
    expect(query).toEqual({ q: "KFC", kind: "all", sort: "newest", page: 1 });
    expect(isCanonicalOpportunityQuery(raw, query)).toBe(false);
    expect(buildOpportunitiesHref(query)).toBe("/opportunities?q=KFC");
  });

  it("produces only the supported repository options", () => {
    const query = parseOpportunityQueryState({
      q: "client",
      service: "event_coverage",
      kind: "ordinary",
      stage: "negotiation",
      sort: "oldest",
      page: "2",
    });
    expect(toOpportunityListOptions(query, 25)).toEqual({
      query: "client",
      service: "event_coverage",
      kind: "ordinary",
      pipelineStage: "negotiation",
      sort: "oldest",
      page: 2,
      pageSize: 25,
    });
  });

  it("preserves filters in pagination URLs", () => {
    const query = parseOpportunityQueryState({
      q: "agency",
      service: "food_review",
      kind: "conversion",
      sort: "value_asc",
      page: "2",
    });
    expect(buildOpportunitiesHref(query, { page: 3 })).toBe(
      "/opportunities?q=agency&service=food_review&kind=conversion&sort=value_asc&page=3",
    );
  });

  it("clears filters without discarding the selected sort", () => {
    const query = parseOpportunityQueryState({
      q: "agency",
      service: "other",
      kind: "ordinary",
      sort: "oldest",
      page: "8",
    });
    expect(clearOpportunityFiltersHref(query)).toBe(
      "/opportunities?sort=oldest",
    );
  });

  it("detects active filters independently from sorting", () => {
    expect(
      hasOpportunityFilters(parseOpportunityQueryState({ sort: "oldest" })),
    ).toBe(false);
    expect(
      hasOpportunityFilters(parseOpportunityQueryState({ kind: "ordinary" })),
    ).toBe(true);
    expect(
      hasOpportunityFilters(parseOpportunityQueryState({ stage: "won" })),
    ).toBe(true);
  });

  it("calculates safe visible ranges", () => {
    expect(getOpportunityResultRange(1, 25, 0)).toEqual({
      first: 0,
      last: 0,
    });
    expect(getOpportunityResultRange(2, 25, 42)).toEqual({
      first: 26,
      last: 42,
    });
  });
});
