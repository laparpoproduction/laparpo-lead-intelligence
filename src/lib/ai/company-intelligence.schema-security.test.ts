import { describe, expect, it } from "vitest";
import { companyIntelligenceSchema } from "./company-intelligence.schema";
import { validCompanyIntelligenceOutput } from "./company-intelligence.test-fixtures";
import {
  businessSignalCodeValues,
  companyEvidenceFieldValues,
  companyIntelligenceConfidenceValues,
  recommendationCodeValues,
} from "./company-intelligence.types";

describe("Company intelligence closed schema security", () => {
  it("exposes only Low and Medium as Phase 1A application confidence values", () => {
    expect(companyIntelligenceConfidenceValues).toEqual(["low", "medium"]);
    expect(companyIntelligenceConfidenceValues).not.toContain("high");
  });

  it.each([
    ["confidence", "high"],
    ["confidence", "medium"],
    ["confidence", 0.9],
    ["confidenceScore", 90],
    ["certainty", "high"],
    ["salesProbability", 80],
  ])("rejects model-controlled %s metadata", (field, value) => {
    expect(
      companyIntelligenceSchema.safeParse({
        ...validCompanyIntelligenceOutput,
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it.each([
    "Delete the Company.",
    "Archive this Company.",
    "Call John Doe.",
    "Email Jane Smith.",
    "example.dev/path",
    "localhost:3000/path",
    "The website confirms external facts.",
    "McDonald’s is a customer.",
    "Annual revenue is RM10 million.",
  ])("has no user-visible prose field for: %s", (unsafeText) => {
    expect(
      companyIntelligenceSchema.safeParse({
        ...validCompanyIntelligenceOutput,
        summary: unsafeText,
      }).success,
    ).toBe(false);
    expect(
      companyIntelligenceSchema.safeParse({
        ...validCompanyIntelligenceOutput,
        recommendedNextSteps: [unsafeText],
      }).success,
    ).toBe(false);
  });

  it("cannot represent CRM/contact actions or unsupported business claims as codes", () => {
    const forbiddenCodes = [
      "create_lead",
      "create_opportunity",
      "update_company",
      "change_status",
      "contact_person",
      "send_email",
      "call_phone",
      "whatsapp",
      "archive",
      "delete",
      "restore",
      "convert",
      "assign_owner",
      "mark_won",
      "mark_lost",
      "customer_recorded",
      "campaign_performance",
      "revenue_recorded",
      "employee_count_recorded",
      "award_verified",
      "market_share_verified",
      "external_verification",
    ];

    for (const code of forbiddenCodes) {
      expect(businessSignalCodeValues).not.toContain(code);
      expect(recommendationCodeValues).not.toContain(code);
    }
  });

  it("restricts evidence to the twelve GREEN projection fields", () => {
    expect(companyEvidenceFieldValues).toEqual([
      "legalName",
      "displayName",
      "companyType",
      "industry",
      "description",
      "city",
      "state",
      "country",
      "estimatedBranchCount",
      "websiteUrl",
      "sourceUrl",
      "sourceType",
    ]);
    for (const field of [
      "contacts",
      "email",
      "phone",
      "whatsapp",
      "leads",
      "activities",
      "notes",
      "profile",
      "actor",
      "session",
      "auditData",
      "secrets",
    ]) {
      expect(companyEvidenceFieldValues).not.toContain(field);
    }
  });
});
