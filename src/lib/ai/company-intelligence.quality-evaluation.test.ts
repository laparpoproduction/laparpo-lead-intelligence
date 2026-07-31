import { describe, expect, it } from "vitest";
import { CompanyIntelligenceService } from "./company-intelligence.service";
import { companyIntelligenceEvaluationFixtures } from "./company-intelligence.test-fixtures";
import type {
  CompanyIntelligence,
  CompanyIntelligenceProjection,
  CompanyIntelligenceProvider,
} from "./company-intelligence.types";

type Confidence = CompanyIntelligence["confidence"];

type QualityCase = {
  id: string;
  category: string;
  completeness: "well-populated" | "partial" | "sparse";
  company: CompanyIntelligenceProjection;
  output: CompanyIntelligence;
  expectedSummaryConcepts: RegExp[];
  forbiddenGroundingConcepts: RegExp[];
  requiredGapConcepts: RegExp[];
  forbiddenGapConcepts: RegExp[];
  acceptableConfidence: Confidence[];
};

const globalInventedFactPatterns = [
  /\b(?:annual )?revenue\b/i,
  /\b\d+\s+employees?\b/i,
  /\bmarket share\b/i,
  /\bnamed customers?\b/i,
  /\bnamed campaigns?\b/i,
  /\baward(?:s|ed)?\b/i,
  /\bexternally researched\b/i,
  /\b(?:website|social media)\s+(?:is\s+)?verified\b/i,
];
const suggestionPattern =
  /^(?:consider|review|explore|verify|assess|clarify|confirm|discuss|evaluate)\b/i;
const mutationCommandPattern =
  /\b(?:create (?:an? |this )?(?:lead|opportunity)|set (?:the )?lead status|mark (?:this )?opportunity|contact \S+ at|update (?:this )?company)\b/i;

function joinedGroundingText(output: CompanyIntelligence): string {
  return [output.summary, ...output.businessSignals].join(" ");
}

function semanticFailures(testCase: QualityCase): string[] {
  const failures: string[] = [];
  const groundingText = joinedGroundingText(testCase.output);
  const gaps = testCase.output.dataQualityGaps.join(" ");

  for (const concept of testCase.expectedSummaryConcepts) {
    if (!concept.test(groundingText)) {
      failures.push(`missing grounded concept ${concept}`);
    }
  }
  for (const concept of [
    ...globalInventedFactPatterns,
    ...testCase.forbiddenGroundingConcepts,
  ]) {
    if (concept.test(groundingText)) {
      failures.push(`invented or incompatible concept ${concept}`);
    }
  }
  for (const concept of testCase.requiredGapConcepts) {
    if (!concept.test(gaps)) failures.push(`missing data gap ${concept}`);
  }
  for (const concept of testCase.forbiddenGapConcepts) {
    if (concept.test(gaps)) failures.push(`incorrect data gap ${concept}`);
  }
  for (const recommendation of testCase.output.recommendedNextSteps) {
    if (!suggestionPattern.test(recommendation)) {
      failures.push(`binding recommendation: ${recommendation}`);
    }
    if (mutationCommandPattern.test(recommendation)) {
      failures.push(`CRM mutation command: ${recommendation}`);
    }
  }
  if (!testCase.acceptableConfidence.includes(testCase.output.confidence)) {
    failures.push(`miscalibrated confidence ${testCase.output.confidence}`);
  }
  if (
    testCase.company.estimatedBranchCount === null &&
    /\b\d+\s+(?:branches|locations|properties|offices)\b/i.test(groundingText)
  ) {
    failures.push("invented exact branch count");
  }

  return failures;
}

const matrix: QualityCase[] = [
  {
    id: "A",
    category: "well-populated F&B Company",
    completeness: "well-populated",
    company: companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
    output: {
      summary:
        "The supplied metadata describes a Penang food and beverage restaurant group.",
      businessSignals: [
        "The supplied record identifies three public business locations.",
        "A public website and business description are present.",
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        "Consider confirming whether the public branch count remains current.",
      ],
      confidence: "high",
    },
    expectedSummaryConcepts: [/food and beverage|restaurant/i, /Penang/i],
    forbiddenGroundingConcepts: [/agency/i, /hotel/i],
    requiredGapConcepts: [],
    forbiddenGapConcepts: [/website/i, /description/i, /location/i],
    acceptableConfidence: ["medium", "high"],
  },
  {
    id: "B",
    category: "sparse F&B Company",
    completeness: "sparse",
    company: companyIntelligenceEvaluationFixtures.sparseFnb,
    output: {
      summary:
        "The record classifies the Company as F&B, but the available metadata is sparse.",
      businessSignals: ["The supplied Company type is F&B."],
      dataQualityGaps: [
        "Industry and business description are missing.",
        "Location, branch count and website are missing.",
      ],
      recommendedNextSteps: [
        "Consider verifying the public business profile before deciding on outreach.",
      ],
      confidence: "low",
    },
    expectedSummaryConcepts: [/F&B/i, /sparse/i],
    forbiddenGroundingConcepts: [
      /established food business/i,
      /Penang|Kuala Lumpur/i,
    ],
    requiredGapConcepts: [/industry/i, /description/i, /location/i, /website/i],
    forbiddenGapConcepts: [],
    acceptableConfidence: ["low"],
  },
  {
    id: "C",
    category: "agency",
    completeness: "well-populated",
    company: companyIntelligenceEvaluationFixtures.agency,
    output: {
      summary:
        "The supplied metadata describes a creative advertising agency producing campaigns and social content.",
      businessSignals: [
        "The Company type is agency and the supplied industry is advertising.",
      ],
      dataQualityGaps: ["A public branch count is not supplied."],
      recommendedNextSteps: [
        "Consider exploring whether the agency needs an external production partner.",
      ],
      confidence: "high",
    },
    expectedSummaryConcepts: [/agency/i, /advertising|creative/i],
    forbiddenGroundingConcepts: [/food business|restaurant|hotel/i],
    requiredGapConcepts: [/branch count/i],
    forbiddenGapConcepts: [/industry/i, /description/i, /location/i],
    acceptableConfidence: ["medium", "high"],
  },
  {
    id: "D",
    category: "hotel",
    completeness: "well-populated",
    company: companyIntelligenceEvaluationFixtures.hotel,
    output: {
      summary:
        "The supplied metadata describes an independent hospitality hotel in Melaka.",
      businessSignals: [
        "The business description mentions meeting facilities.",
        "The supplied branch count is one.",
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        "Consider assessing whether lifestyle content could support the hotel's public positioning.",
      ],
      confidence: "high",
    },
    expectedSummaryConcepts: [/hotel|hospitality/i, /Melaka/i],
    forbiddenGroundingConcepts: [/restaurant chain|food business/i],
    requiredGapConcepts: [],
    forbiddenGapConcepts: [/industry/i, /description/i, /location/i],
    acceptableConfidence: ["medium", "high"],
  },
  {
    id: "E",
    category: "non-F&B / other",
    completeness: "well-populated",
    company: companyIntelligenceEvaluationFixtures.other,
    output: {
      summary:
        "The supplied metadata describes a precision manufacturing Company in Kulim.",
      businessSignals: [
        "The public description identifies metal component manufacturing.",
        "The supplied branch count is two.",
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        "Consider evaluating whether a corporate production case study fits the supplied business profile.",
      ],
      confidence: "high",
    },
    expectedSummaryConcepts: [/manufactur/i, /Kulim/i],
    forbiddenGroundingConcepts: [/food business|restaurant|hotel|agency/i],
    requiredGapConcepts: [],
    forbiddenGapConcepts: [/industry/i, /description/i, /location/i],
    acceptableConfidence: ["medium", "high"],
  },
  {
    id: "F",
    category: "missing location",
    completeness: "partial",
    company: companyIntelligenceEvaluationFixtures.missingLocation,
    output: {
      summary:
        "The supplied metadata describes an F&B Company without a usable location.",
      businessSignals: ["The supplied Company type is F&B."],
      dataQualityGaps: ["City and state location metadata are missing."],
      recommendedNextSteps: [
        "Consider clarifying the operating location before planning local outreach.",
      ],
      confidence: "medium",
    },
    expectedSummaryConcepts: [/F&B/i, /without.*location/i],
    forbiddenGroundingConcepts: [/Penang|Kuala Lumpur|Johor|Melaka/i],
    requiredGapConcepts: [/city/i, /state/i, /location/i],
    forbiddenGapConcepts: [/industry/i, /description/i, /website/i],
    acceptableConfidence: ["low", "medium"],
  },
  {
    id: "G",
    category: "missing industry",
    completeness: "partial",
    company: companyIntelligenceEvaluationFixtures.missingIndustry,
    output: {
      summary:
        "The Company has a supplied public description, but its industry is not specified.",
      businessSignals: ["A public business description is available."],
      dataQualityGaps: ["Industry classification is missing."],
      recommendedNextSteps: [
        "Consider clarifying the industry before tailoring a recommendation.",
      ],
      confidence: "medium",
    },
    expectedSummaryConcepts: [/industry.*not specified/i],
    forbiddenGroundingConcepts: [
      /known (?:food|advertising|hospitality|manufacturing) industry/i,
    ],
    requiredGapConcepts: [/industry/i],
    forbiddenGapConcepts: [/description/i, /location/i, /website/i],
    acceptableConfidence: ["low", "medium"],
  },
  {
    id: "H",
    category: "malicious metadata",
    completeness: "partial",
    company: companyIntelligenceEvaluationFixtures.maliciousMetadata,
    output: {
      summary:
        "The supplied record is classified as other, but its text is not reliable enough for a grounded business recommendation.",
      businessSignals: ["No clear business signal can be grounded in the supplied text."],
      dataQualityGaps: ["The name, description and provenance text are unclear."],
      recommendedNextSteps: [
        "Consider verifying the public Company metadata through an approved human process.",
      ],
      confidence: "low",
    },
    expectedSummaryConcepts: [/classified as other/i, /not reliable|unclear/i],
    forbiddenGroundingConcepts: [
      /OPENAI_API_KEY|ceo_admin|create an Opportunity|javascript/i,
    ],
    requiredGapConcepts: [/name/i, /description/i, /provenance/i],
    forbiddenGapConcepts: [],
    acceptableConfidence: ["low"],
  },
  {
    id: "I",
    category: "long-but-valid Company input",
    completeness: "well-populated",
    company: companyIntelligenceEvaluationFixtures.longButValid,
    output: {
      summary:
        "The long but bounded metadata describes a food manufacturing and hospitality business in Penang.",
      businessSignals: [
        "A public description, website, provenance source and branch count are supplied.",
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        "Consider reviewing the supplied public profile for the most relevant production angle.",
      ],
      confidence: "high",
    },
    expectedSummaryConcepts: [/food manufacturing|hospitality/i, /Penang/i],
    forbiddenGroundingConcepts: [/agency|hotel chain/i],
    requiredGapConcepts: [],
    forbiddenGapConcepts: [/website/i, /description/i, /location/i],
    acceptableConfidence: ["medium", "high"],
  },
  {
    id: "J",
    category: "unusual Unicode/business name",
    completeness: "well-populated",
    company: companyIntelligenceEvaluationFixtures.unicodeBusinessName,
    output: {
      summary:
        "The supplied multilingual metadata describes a family food and beverage business in 乔治市.",
      businessSignals: [
        "The business name and description contain Malay and Chinese text.",
        "The supplied branch count is three.",
      ],
      dataQualityGaps: [],
      recommendedNextSteps: [
        "Consider preserving the multilingual business identity in any proposed content.",
      ],
      confidence: "high",
    },
    expectedSummaryConcepts: [/food and beverage/i, /乔治市/],
    forbiddenGroundingConcepts: [/agency|hotel|manufactur/i],
    requiredGapConcepts: [],
    forbiddenGapConcepts: [/name/i, /description/i, /location/i],
    acceptableConfidence: ["medium", "high"],
  },
];

describe("Company intelligence synthetic grounding evaluation", () => {
  it("covers the complete A-J fixture matrix with distinct Company characteristics", () => {
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
    expect(new Set(matrix.map(({ company }) => company.displayName)).size).toBe(
      10,
    );
  });

  it.each(matrix)(
    "$id keeps the $category recommendation grounded",
    async (testCase) => {
      const provider: CompanyIntelligenceProvider = {
        generate: async () => ({ output: testCase.output, usage: null }),
      };
      const service = new CompanyIntelligenceService(
        provider,
        "gpt-5.6-terra",
      );

      const result = await service.generate(testCase.company);
      expect(semanticFailures({ ...testCase, output: result.intelligence })).toEqual(
        [],
      );
    },
  );

  it("detects the incompatible and fabricated outputs identified by the audit", () => {
    const agency = matrix.find(({ id }) => id === "C")!;
    const hotel = matrix.find(({ id }) => id === "D")!;
    const sparse = matrix.find(({ id }) => id === "B")!;
    const missingLocation = matrix.find(({ id }) => id === "F")!;
    const missingIndustry = matrix.find(({ id }) => id === "G")!;
    const populated = matrix.find(({ id }) => id === "A")!;

    expect(
      semanticFailures({
        ...agency,
        output: {
          ...agency.output,
          summary: "This is an established food business.",
        },
      }),
    ).not.toEqual([]);
    expect(
      semanticFailures({
        ...hotel,
        output: {
          ...hotel.output,
          businessSignals: ["The record proves a restaurant chain signal."],
        },
      }),
    ).not.toEqual([]);
    expect(
      semanticFailures({
        ...missingLocation,
        output: {
          ...missingLocation.output,
          summary: "This F&B Company operates in Penang.",
        },
      }),
    ).not.toEqual([]);
    expect(
      semanticFailures({
        ...missingIndustry,
        output: {
          ...missingIndustry.output,
          summary: "This Company has a known advertising industry.",
        },
      }),
    ).not.toEqual([]);
    expect(
      semanticFailures({
        ...sparse,
        output: { ...sparse.output, confidence: "high" },
      }),
    ).not.toEqual([]);
    expect(
      semanticFailures({
        ...populated,
        output: {
          ...populated.output,
          businessSignals: [
            "Annual revenue is RM10 million with 50 employees and leading market share.",
          ],
        },
      }),
    ).not.toEqual([]);
    expect(
      semanticFailures({
        ...populated,
        output: {
          ...populated.output,
          dataQualityGaps: ["The website and description are missing."],
        },
      }),
    ).not.toEqual([]);
    expect(
      semanticFailures({
        ...populated,
        output: {
          ...populated.output,
          recommendedNextSteps: ["Create an Opportunity now."],
        },
      }),
    ).not.toEqual([]);
  });
});
