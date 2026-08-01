import { describe, expect, it } from "vitest";
import { renderCompanyIntelligence } from "./company-intelligence.render";
import {
  CompanyIntelligenceService,
  InvalidCompanyIntelligenceOutputError,
} from "./company-intelligence.service";
import { companyIntelligenceEvaluationFixtures } from "./company-intelligence.test-fixtures";
import type {
  BusinessSignalCode,
  CompanyGapField,
  CompanyIntelligenceProjection,
  CompanyIntelligenceConfidence,
  CompanyIntelligenceProvider,
  CompanyIntelligenceStructuredOutput,
} from "./company-intelligence.types";

type QualityCase = {
  id: string;
  category: string;
  company: CompanyIntelligenceProjection;
  output: CompanyIntelligenceStructuredOutput;
  incompatibleSignal: BusinessSignalCode;
  falseGap: CompanyGapField;
  expectedConfidence: CompanyIntelligenceConfidence;
};

const matrix: QualityCase[] = [
  {
    id: "A",
    category: "well-populated F&B",
    company: companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
    output: {
      profileAssessment: {
        code: "well_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description", "websiteUrl"],
      },
      businessSignals: [
        { code: "fnb_business_profile", evidenceFields: ["companyType"] },
        { code: "public_description_present", evidenceFields: ["description"] },
        { code: "public_website_recorded", evidenceFields: ["websiteUrl"] },
        {
          code: "location_recorded",
          evidenceFields: ["city", "state", "country"],
        },
        {
          code: "branch_count_recorded",
          evidenceFields: ["estimatedBranchCount"],
        },
        {
          code: "potential_content_partnership_fit",
          evidenceFields: ["companyType", "industry"],
        },
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        { code: "review_public_company_profile", evidenceFields: ["displayName"] },
        {
          code: "verify_branch_count_manually",
          evidenceFields: ["estimatedBranchCount"],
        },
        {
          code: "assess_content_partnership_fit",
          evidenceFields: ["companyType", "industry"],
        },
      ],
    },
    incompatibleSignal: "agency_business_profile",
    falseGap: "websiteUrl",
    expectedConfidence: "medium",
  },
  {
    id: "B",
    category: "sparse F&B",
    company: companyIntelligenceEvaluationFixtures.sparseFnb,
    output: {
      profileAssessment: {
        code: "sparse_public_profile",
        evidenceFields: ["companyType"],
      },
      businessSignals: [
        { code: "fnb_business_profile", evidenceFields: ["companyType"] },
      ],
      dataQualityGaps: [
        "industry",
        "description",
        "city",
        "state",
        "estimatedBranchCount",
        "websiteUrl",
      ],
      recommendedNextSteps: [
        { code: "review_public_company_profile", evidenceFields: ["displayName"] },
        { code: "clarify_industry", evidenceFields: ["companyType"] },
        {
          code: "clarify_location",
          evidenceFields: ["companyType", "country"],
        },
      ],
    },
    incompatibleSignal: "public_website_recorded",
    falseGap: "sourceType",
    expectedConfidence: "low",
  },
  {
    id: "C",
    category: "agency",
    company: companyIntelligenceEvaluationFixtures.agency,
    output: {
      profileAssessment: {
        code: "well_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description", "websiteUrl"],
      },
      businessSignals: [
        {
          code: "agency_business_profile",
          evidenceFields: ["companyType", "industry"],
        },
        {
          code: "potential_production_partner_fit",
          evidenceFields: ["companyType", "description"],
        },
      ],
      dataQualityGaps: ["estimatedBranchCount"],
      recommendedNextSteps: [
        {
          code: "assess_production_partnership_fit",
          evidenceFields: ["companyType", "industry"],
        },
        { code: "review_public_positioning", evidenceFields: ["description"] },
      ],
    },
    incompatibleSignal: "fnb_business_profile",
    falseGap: "industry",
    expectedConfidence: "medium",
  },
  {
    id: "D",
    category: "hotel",
    company: companyIntelligenceEvaluationFixtures.hotel,
    output: {
      profileAssessment: {
        code: "well_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description", "websiteUrl"],
      },
      businessSignals: [
        { code: "hotel_hospitality_profile", evidenceFields: ["companyType"] },
        {
          code: "potential_content_partnership_fit",
          evidenceFields: ["companyType", "industry"],
        },
        {
          code: "branch_count_recorded",
          evidenceFields: ["estimatedBranchCount"],
        },
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        {
          code: "assess_content_partnership_fit",
          evidenceFields: ["companyType", "description"],
        },
      ],
    },
    incompatibleSignal: "agency_business_profile",
    falseGap: "description",
    expectedConfidence: "medium",
  },
  {
    id: "E",
    category: "non-F&B/other",
    company: companyIntelligenceEvaluationFixtures.other,
    output: {
      profileAssessment: {
        code: "well_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description", "websiteUrl"],
      },
      businessSignals: [
        { code: "other_business_profile", evidenceFields: ["companyType"] },
        { code: "public_description_present", evidenceFields: ["description"] },
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        { code: "review_public_positioning", evidenceFields: ["description"] },
      ],
    },
    incompatibleSignal: "potential_content_partnership_fit",
    falseGap: "city",
    expectedConfidence: "medium",
  },
  {
    id: "F",
    category: "missing location",
    company: companyIntelligenceEvaluationFixtures.missingLocation,
    output: {
      profileAssessment: {
        code: "partially_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description", "websiteUrl"],
      },
      businessSignals: [
        { code: "fnb_business_profile", evidenceFields: ["companyType"] },
      ],
      dataQualityGaps: ["city", "state"],
      recommendedNextSteps: [
        {
          code: "clarify_location",
          evidenceFields: ["companyType", "country"],
        },
      ],
    },
    incompatibleSignal: "location_recorded",
    falseGap: "industry",
    expectedConfidence: "medium",
  },
  {
    id: "G",
    category: "missing industry",
    company: companyIntelligenceEvaluationFixtures.missingIndustry,
    output: {
      profileAssessment: {
        code: "partially_populated_public_profile",
        evidenceFields: ["companyType", "description", "websiteUrl"],
      },
      businessSignals: [
        { code: "public_description_present", evidenceFields: ["description"] },
      ],
      dataQualityGaps: ["industry"],
      recommendedNextSteps: [
        { code: "clarify_industry", evidenceFields: ["companyType"] },
      ],
    },
    incompatibleSignal: "agency_business_profile",
    falseGap: "description",
    expectedConfidence: "medium",
  },
  {
    id: "H",
    category: "malicious metadata",
    company: companyIntelligenceEvaluationFixtures.maliciousMetadata,
    output: {
      profileAssessment: {
        code: "partially_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description"],
      },
      businessSignals: [
        { code: "other_business_profile", evidenceFields: ["companyType"] },
      ],
      dataQualityGaps: ["websiteUrl", "sourceUrl"],
      recommendedNextSteps: [
        { code: "review_public_company_profile", evidenceFields: ["displayName"] },
      ],
    },
    incompatibleSignal: "public_website_recorded",
    falseGap: "sourceType",
    expectedConfidence: "medium",
  },
  {
    id: "I",
    category: "long-but-valid input",
    company: companyIntelligenceEvaluationFixtures.longButValid,
    output: {
      profileAssessment: {
        code: "well_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description", "websiteUrl"],
      },
      businessSignals: [
        { code: "fnb_business_profile", evidenceFields: ["companyType"] },
        { code: "public_description_present", evidenceFields: ["description"] },
        { code: "public_website_recorded", evidenceFields: ["websiteUrl"] },
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        { code: "review_public_positioning", evidenceFields: ["description"] },
      ],
    },
    incompatibleSignal: "agency_business_profile",
    falseGap: "websiteUrl",
    expectedConfidence: "medium",
  },
  {
    id: "J",
    category: "Unicode/business name",
    company: companyIntelligenceEvaluationFixtures.unicodeBusinessName,
    output: {
      profileAssessment: {
        code: "well_populated_public_profile",
        evidenceFields: ["companyType", "industry", "description", "websiteUrl"],
      },
      businessSignals: [
        { code: "fnb_business_profile", evidenceFields: ["companyType"] },
        {
          code: "location_recorded",
          evidenceFields: ["city", "state", "country"],
        },
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        { code: "review_public_company_profile", evidenceFields: ["displayName"] },
      ],
    },
    incompatibleSignal: "hotel_hospitality_profile",
    falseGap: "description",
    expectedConfidence: "medium",
  },
];

function provider(output: unknown): CompanyIntelligenceProvider {
  return { generate: async () => ({ output, usage: null }) };
}

function service(output: unknown) {
  return new CompanyIntelligenceService(provider(output), "gpt-5.6-terra");
}

describe("Company intelligence A-J structured quality evaluation", () => {
  it("retains ten distinct synthetic fixtures", () => {
    expect(matrix.map(({ id }) => id)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
    ]);
    expect(new Set(matrix.map(({ category }) => category)).size).toBe(10);
    expect(new Set(matrix.map(({ company }) => company.displayName)).size).toBe(10);
  });

  it.each(matrix)(
    "$id accepts only grounded $category codes, gaps, evidence and confidence",
    async ({ company, output, expectedConfidence }) => {
      await expect(service(output).generate(company)).resolves.toEqual({
        intelligence: renderCompanyIntelligence(company, {
          ...output,
          confidence: expectedConfidence,
        }),
        model: "gpt-5.6-terra",
        usage: null,
      });
    },
  );

  it.each(matrix)(
    "$id rejects its incompatible signal",
    async ({ company, output, incompatibleSignal }) => {
      const incompatible = {
        ...output,
        businessSignals: [
          { code: incompatibleSignal, evidenceFields: ["companyType"] },
        ],
      };
      await expect(service(incompatible).generate(company)).rejects.toBeInstanceOf(
        InvalidCompanyIntelligenceOutputError,
      );
    },
  );

  it.each(matrix)(
    "$id rejects a false present-field gap",
    async ({ company, output, falseGap }) => {
      await expect(
        service({
          ...output,
          dataQualityGaps: [falseGap],
          recommendedNextSteps: [],
        }).generate(company),
      ).rejects.toBeInstanceOf(InvalidCompanyIntelligenceOutputError);
    },
  );

  it.each(matrix)(
    "$id derives $expectedConfidence confidence from its validated profile",
    async ({ company, output, expectedConfidence }) => {
      await expect(service(output).generate(company)).resolves.toMatchObject({
        intelligence: { confidence: expectedConfidence },
      });
    },
  );

  it.each(matrix)(
    "$id renders fixed text rather than model-controlled prose",
    ({ company, output, expectedConfidence }) => {
      const rendered = renderCompanyIntelligence(company, {
        ...output,
        confidence: expectedConfidence,
      });
      const serialized = JSON.stringify(rendered);
      expect(serialized).not.toContain(output.profileAssessment.code);
      for (const item of [
        ...output.businessSignals,
        ...output.recommendedNextSteps,
      ]) {
        expect(serialized).not.toContain(item.code);
      }
      expect(serialized).not.toMatch(/https?:\/\//iu);
    },
  );
});
