import { describe, expect, it } from "vitest";
import {
  CompanyIntelligenceEvidenceError,
  validateCompanyIntelligenceEvidence,
} from "./company-intelligence.evidence";
import {
  companyIntelligenceEvaluationFixtures,
  validCompanyIntelligenceOutput,
} from "./company-intelligence.test-fixtures";
import type {
  BusinessSignalCode,
  CompanyEvidenceField,
  CompanyIntelligenceProjection,
  CompanyIntelligenceStructuredOutput,
  RecommendationCode,
} from "./company-intelligence.types";

function withSignal(
  company: CompanyIntelligenceProjection,
  code: BusinessSignalCode,
  evidenceFields: CompanyEvidenceField[],
  profileCode: CompanyIntelligenceStructuredOutput["profileAssessment"]["code"] =
    "well_populated_public_profile",
): CompanyIntelligenceStructuredOutput {
  return {
    profileAssessment: { code: profileCode, evidenceFields: ["companyType"] },
    businessSignals: [{ code, evidenceFields }],
    dataQualityGaps: [],
    recommendedNextSteps: [],
    confidence: profileCode === "sparse_public_profile" ? "low" : "medium",
  };
}

function expectRejected(
  company: CompanyIntelligenceProjection,
  output: CompanyIntelligenceStructuredOutput,
) {
  expect(() => validateCompanyIntelligenceEvidence(company, output)).toThrow(
    CompanyIntelligenceEvidenceError,
  );
}

describe("Company intelligence evidence validation", () => {
  it.each([
    ["fnb_business_profile", "wellPopulatedFnb", ["companyType"]],
    ["agency_business_profile", "agency", ["companyType", "industry"]],
    ["hotel_hospitality_profile", "hotel", ["companyType"]],
    ["other_business_profile", "other", ["companyType"]],
    ["public_description_present", "wellPopulatedFnb", ["description"]],
    ["public_website_recorded", "wellPopulatedFnb", ["websiteUrl"]],
    ["location_recorded", "wellPopulatedFnb", ["city", "state", "country"]],
    ["branch_count_recorded", "wellPopulatedFnb", ["estimatedBranchCount"]],
    [
      "potential_content_partnership_fit",
      "hotel",
      ["companyType", "description"],
    ],
    [
      "potential_production_partner_fit",
      "agency",
      ["companyType", "industry"],
    ],
  ] as const)("accepts grounded signal %s", (code, fixture, evidenceFields) => {
    const company = companyIntelligenceEvaluationFixtures[fixture];
    expect(
      validateCompanyIntelligenceEvidence(
        company,
        withSignal(company, code, [...evidenceFields]),
      ),
    ).toBeDefined();
  });

  it.each([
    ["review_public_company_profile", "wellPopulatedFnb", ["displayName"]],
    ["verify_branch_count_manually", "wellPopulatedFnb", ["estimatedBranchCount"]],
    ["review_public_positioning", "wellPopulatedFnb", ["description"]],
    ["assess_content_partnership_fit", "hotel", ["companyType"]],
    ["assess_production_partnership_fit", "agency", ["companyType"]],
    ["review_available_public_provenance", "other", ["sourceType"]],
  ] as const)(
    "accepts grounded recommendation %s",
    (code, fixture, evidenceFields) => {
      const company = companyIntelligenceEvaluationFixtures[fixture];
      const output = withSignal(
        company,
        company.companyType === "agency"
          ? "agency_business_profile"
          : company.companyType === "hotel"
            ? "hotel_hospitality_profile"
            : company.companyType === "fnb"
              ? "fnb_business_profile"
              : "other_business_profile",
        ["companyType"],
      );
      output.recommendedNextSteps = [
        { code: code as RecommendationCode, evidenceFields: [...evidenceFields] },
      ];
      expect(validateCompanyIntelligenceEvidence(company, output)).toBeDefined();
    },
  );

  it("accepts clarification codes only when matching gaps are grounded", () => {
    const missingIndustry = companyIntelligenceEvaluationFixtures.missingIndustry;
    const industryOutput: CompanyIntelligenceStructuredOutput = {
      profileAssessment: {
        code: "partially_populated_public_profile",
        evidenceFields: ["companyType", "description"],
      },
      businessSignals: [
        { code: "public_description_present", evidenceFields: ["description"] },
      ],
      dataQualityGaps: ["industry"],
      recommendedNextSteps: [
        { code: "clarify_industry", evidenceFields: ["companyType"] },
      ],
      confidence: "medium",
    };
    expect(
      validateCompanyIntelligenceEvidence(missingIndustry, industryOutput),
    ).toBeDefined();

    const missingLocation = companyIntelligenceEvaluationFixtures.missingLocation;
    const locationOutput: CompanyIntelligenceStructuredOutput = {
      ...industryOutput,
      profileAssessment: {
        code: "partially_populated_public_profile",
        evidenceFields: ["companyType", "industry"],
      },
      dataQualityGaps: ["city", "state"],
      recommendedNextSteps: [
        { code: "clarify_location", evidenceFields: ["companyType", "country"] },
      ],
    };
    expect(
      validateCompanyIntelligenceEvidence(missingLocation, locationOutput),
    ).toBeDefined();
  });

  it("rejects codes contradicted by the supplied Company category", () => {
    expectRejected(
      companyIntelligenceEvaluationFixtures.agency,
      withSignal(
        companyIntelligenceEvaluationFixtures.agency,
        "fnb_business_profile",
        ["companyType"],
      ),
    );
    expectRejected(
      companyIntelligenceEvaluationFixtures.hotel,
      withSignal(
        companyIntelligenceEvaluationFixtures.hotel,
        "agency_business_profile",
        ["companyType"],
      ),
    );
  });

  it("rejects absent fields as present and present fields as gaps", () => {
    expectRejected(
      companyIntelligenceEvaluationFixtures.sparseFnb,
      withSignal(
        companyIntelligenceEvaluationFixtures.sparseFnb,
        "public_website_recorded",
        ["websiteUrl"],
        "sparse_public_profile",
      ),
    );
    expectRejected(companyIntelligenceEvaluationFixtures.wellPopulatedFnb, {
      ...validCompanyIntelligenceOutput,
      dataQualityGaps: ["websiteUrl"],
    });
    expectRejected(
      companyIntelligenceEvaluationFixtures.sparseFnb,
      withSignal(
        companyIntelligenceEvaluationFixtures.sparseFnb,
        "branch_count_recorded",
        ["estimatedBranchCount"],
        "sparse_public_profile",
      ),
    );
  });

  it("rejects unknown, absent, irrelevant, empty and duplicate evidence", () => {
    expectRejected(companyIntelligenceEvaluationFixtures.wellPopulatedFnb, {
      ...validCompanyIntelligenceOutput,
      businessSignals: [
        { code: "public_website_recorded", evidenceFields: ["description"] },
      ],
    });
    expectRejected(companyIntelligenceEvaluationFixtures.wellPopulatedFnb, {
      ...validCompanyIntelligenceOutput,
      businessSignals: [
        {
          code: "fnb_business_profile",
          evidenceFields: ["companyType", "companyType"],
        },
      ],
    });
    expectRejected(companyIntelligenceEvaluationFixtures.wellPopulatedFnb, {
      ...validCompanyIntelligenceOutput,
      businessSignals: [
        { code: "fnb_business_profile", evidenceFields: [] },
      ],
    });
  });

  it("rejects duplicate signal, recommendation and gap codes", () => {
    const signal = validCompanyIntelligenceOutput.businessSignals[0];
    const recommendation = validCompanyIntelligenceOutput.recommendedNextSteps[0];
    expectRejected(companyIntelligenceEvaluationFixtures.wellPopulatedFnb, {
      ...validCompanyIntelligenceOutput,
      businessSignals: [signal, signal],
    });
    expectRejected(companyIntelligenceEvaluationFixtures.wellPopulatedFnb, {
      ...validCompanyIntelligenceOutput,
      recommendedNextSteps: [recommendation, recommendation],
    });
    const sparse = companyIntelligenceEvaluationFixtures.sparseFnb;
    expectRejected(sparse, {
      profileAssessment: {
        code: "sparse_public_profile",
        evidenceFields: ["companyType"],
      },
      businessSignals: [],
      dataQualityGaps: ["industry", "industry"],
      recommendedNextSteps: [],
      confidence: "low",
    });
  });

  it("enforces deterministic confidence upper bounds", () => {
    const sparse = companyIntelligenceEvaluationFixtures.sparseFnb;
    expectRejected(sparse, {
      profileAssessment: {
        code: "sparse_public_profile",
        evidenceFields: ["companyType"],
      },
      businessSignals: [],
      dataQualityGaps: [],
      recommendedNextSteps: [],
      confidence: "high",
    });

    const malicious = companyIntelligenceEvaluationFixtures.maliciousMetadata;
    expectRejected(malicious, {
      profileAssessment: {
        code: "partially_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description"],
      },
      businessSignals: [],
      dataQualityGaps: ["websiteUrl", "sourceUrl"],
      recommendedNextSteps: [],
      confidence: "high",
    });

    const maliciousWithValidUrls = {
      ...malicious,
      websiteUrl: "https://example.test",
      sourceUrl: "https://directory.example.test/record",
    };
    expectRejected(maliciousWithValidUrls, {
      profileAssessment: {
        code: "well_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description", "websiteUrl"],
      },
      businessSignals: [],
      dataQualityGaps: [],
      recommendedNextSteps: [],
      confidence: "high",
    });
  });
});
