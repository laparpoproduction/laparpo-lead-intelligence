import { describe, expect, it } from "vitest";
import {
  validateLeadCreate,
  validateLeadId,
  validateLeadListOptions,
  validateLeadUpdate,
} from "./lead.validation";

describe("lead validation", () => {
  it("normalizes create input and applies defaults", () => {
    const input = validateLeadCreate({
      title: "  KFC Ramadan  ",
      sourceUrl: "https://example.my/lead",
      sourceType: "company_website",
      discoveredAt: "2026-06-01T00:00:00.000Z",
    });

    expect(input.title).toBe("KFC Ramadan");
    expect(input.stage).toBe("new");
    expect(input.leadStatus).toBe("active");
    expect(input.qualificationStatus).toBe("unreviewed");
    expect(input.currency).toBe("MYR");
    expect(input.sourceType).toBe("company_website");
  });

  it("validates and normalizes update payloads", () => {
    const input = validateLeadUpdate({
      title: "  Updated lead  ",
      nextStep: "Follow up",
      sourceCampaign: "Q1 Campaign",
      serviceInterest: "food_review",
    });

    expect(input).toMatchObject({
      title: "Updated lead",
      nextStep: "Follow up",
      sourceCampaign: "Q1 Campaign",
      serviceInterest: "food_review",
    });
  });

  it("canonicalizes list options and pagination", () => {
    const options = validateLeadListOptions({
      query: "  KFC  ",
      page: 2,
      pageSize: 40,
      sortBy: "title",
      sortDirection: "asc",
      includeDeleted: true,
    });

    expect(options).toMatchObject({
      query: "KFC",
      page: 2,
      pageSize: 40,
      sortBy: "title",
      sortDirection: "asc",
      includeDeleted: true,
    });
  });

  it("validates UUIDs", () => {
    expect(validateLeadId("11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });
});
