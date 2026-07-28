import { describe, expect, it } from "vitest";
import {
  buildOpportunityPipelineHref,
  hasOpportunityPipelineFilters,
  isCanonicalOpportunityPipelineQuery,
  parseOpportunityPipelineQuery,
  toOpportunityPipelineFilters,
} from "./opportunity-pipeline-query";

describe("Opportunity pipeline query", () => {
  it("normalizes the small allow-listed filter set", () => {
    const query = parseOpportunityPipelineQuery({
      q: "  campaign  ",
      service: "corporate",
      kind: "conversion",
    });
    expect(query).toEqual({
      q: "campaign",
      service: "corporate",
      kind: "conversion",
    });
    expect(toOpportunityPipelineFilters(query)).toEqual({
      query: "campaign",
      service: "corporate",
      kind: "conversion",
    });
    expect(buildOpportunityPipelineHref(query)).toBe(
      "/opportunities/pipeline?q=campaign&service=corporate&kind=conversion",
    );
  });

  it("drops arbitrary expressions, invalid values and duplicate state", () => {
    const raw = {
      q: ["KFC", "leak"],
      service: "future_service",
      kind: "conversion",
      stage: "new",
      order: "created_at desc; drop table",
    };
    const query = parseOpportunityPipelineQuery(raw);
    expect(query).toEqual({ q: "KFC", kind: "conversion" });
    expect(isCanonicalOpportunityPipelineQuery(raw, query)).toBe(false);
    expect(buildOpportunityPipelineHref(query)).toBe(
      "/opportunities/pipeline?q=KFC&kind=conversion",
    );
  });

  it("detects only meaningful filters", () => {
    expect(hasOpportunityPipelineFilters(parseOpportunityPipelineQuery({}))).toBe(
      false,
    );
    expect(
      hasOpportunityPipelineFilters(
        parseOpportunityPipelineQuery({ service: "food_review" }),
      ),
    ).toBe(true);
  });
});
