import { describe, expect, it } from "vitest";
import {
  businessSignalText,
  dataQualityGapText,
  profileAssessmentText,
  recommendationText,
  renderCompanyIntelligence,
  renderCompanyIntelligenceSummary,
} from "./company-intelligence.render";
import {
  companyIntelligenceEvaluationFixtures,
  validCompanyIntelligenceOutput,
} from "./company-intelligence.test-fixtures";
import {
  businessSignalCodeValues,
  companyGapFieldValues,
  profileAssessmentCodeValues,
  recommendationCodeValues,
} from "./company-intelligence.types";

describe("Company intelligence deterministic renderer", () => {
  it("defines application-controlled text for every allowed code", () => {
    expect(Object.keys(profileAssessmentText)).toEqual([
      ...profileAssessmentCodeValues,
    ]);
    expect(Object.keys(businessSignalText)).toEqual([
      ...businessSignalCodeValues,
    ]);
    expect(Object.keys(dataQualityGapText)).toEqual([...companyGapFieldValues]);
    expect(Object.keys(recommendationText)).toEqual([
      ...recommendationCodeValues,
    ]);
    expect(new Set(Object.values(profileAssessmentText)).size).toBe(
      profileAssessmentCodeValues.length,
    );
    expect(new Set(Object.values(businessSignalText)).size).toBe(
      businessSignalCodeValues.length,
    );
    expect(new Set(Object.values(dataQualityGapText)).size).toBe(
      companyGapFieldValues.length,
    );
    expect(new Set(Object.values(recommendationText)).size).toBe(
      recommendationCodeValues.length,
    );
  });

  it("renders a grounded summary only from fixed templates and GREEN metadata", () => {
    expect(
      renderCompanyIntelligenceSummary(
        companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
        "well_populated_public_profile",
      ),
    ).toBe(
      "The available public metadata describes an F&B Company in George Town, Penang. The recorded industry is Food & Beverage. The profile contains an industry, a description, a location, a public website record and an estimated branch count.",
    );
    expect(
      renderCompanyIntelligenceSummary(
        companyIntelligenceEvaluationFixtures.missingLocation,
        "partially_populated_public_profile",
      ),
    ).not.toContain("undefined");
    const sparseSummary = renderCompanyIntelligenceSummary(
      companyIntelligenceEvaluationFixtures.sparseFnb,
      "sparse_public_profile",
    );
    expect(sparseSummary).toMatch(/^The limited public metadata records/u);
  });

  it("renders every result section without URLs, contacts, CRM commands or verification claims", () => {
    const rendered = renderCompanyIntelligence(
      companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
      validCompanyIntelligenceOutput,
    );
    const text = JSON.stringify(rendered);

    expect(text).not.toMatch(/https?:|www\.|@/iu);
    expect(text).not.toMatch(
      /\b(?:create|update|delete|archive|restore|convert|assign|contact|call|email|whatsapp)\b/iu,
    );
    expect(text).not.toMatch(/\b(?:verified|browsed|website confirms)\b/iu);
    for (const recommendation of rendered.recommendedNextSteps) {
      expect(recommendation).toMatch(/^Consider\b/u);
    }
  });

  it("never renders opaque website or provenance values", () => {
    const malicious = companyIntelligenceEvaluationFixtures.maliciousMetadata;
    const rendered = renderCompanyIntelligence(malicious, {
      profileAssessment: {
        code: "partially_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description"],
      },
      businessSignals: [
        { code: "other_business_profile", evidenceFields: ["companyType"] },
      ],
      dataQualityGaps: ["websiteUrl", "sourceUrl"],
      recommendedNextSteps: [
        {
          code: "review_public_company_profile",
          evidenceFields: ["displayName"],
        },
      ],
      confidence: "low",
    });
    const text = JSON.stringify(rendered);

    expect(text).not.toContain(malicious.websiteUrl);
    expect(text).not.toContain(malicious.sourceUrl);
    expect(text).not.toContain(malicious.displayName);
    expect(text).not.toContain(malicious.description);
  });
});
