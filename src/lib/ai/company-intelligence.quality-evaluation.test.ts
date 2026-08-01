import { describe, expect, it } from "vitest";
import { containsDirectCrmOrContactCommand } from "./company-intelligence.output-safety";
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
  {
    category: "named customer",
    pattern:
      /\b[\p{L}\p{N}][\p{L}\p{N}'’&.-]*(?:\s+[\p{L}\p{N}][\p{L}\p{N}'’&.-]*){0,5}\s+(?:is|are)\s+(?:(?:a|an|the)\s+)?(?:customer|client)s?\b/iu,
  },
  {
    category: "named campaign",
    pattern:
      /\b(?:the\s+)?[\p{L}\p{N}'’&.-]+(?:\s+[\p{L}\p{N}'’&.-]+){1,5}\s+campaign\s+(?:delivered|generated|achieved|reached|won|produced)\b/iu,
  },
  {
    category: "numeric employee count",
    pattern: /\b(?:has\s+|employs?\s+)?\d[\d,]*\s+employees?\b/iu,
  },
  {
    category: "written-number employee count",
    pattern:
      /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand))*\s+employees?\b/iu,
  },
  {
    category: "revenue",
    pattern:
      /\b(?:(?:annual\s+)?revenue\s+(?:is|was|of|totals?|reaches?)\s+(?:RM|MYR|USD|\$)\s*\d[\d,.]*(?:\s+(?:thousand|million|billion))?|(?:RM|MYR|USD|\$)\s*\d[\d,.]*(?:\s+(?:thousand|million|billion))?\s+(?:annual\s+)?revenue)\b/iu,
  },
  {
    category: "market share",
    pattern:
      /\b(?:(?:has|holds|commands|owns)\s+(?:a\s+)?(?:leading|dominant|largest|\d+(?:\.\d+)?%?)?\s*market share|(?:leading|dominant|largest)\s+market share)\b/iu,
  },
  {
    category: "awards",
    pattern:
      /\b(?:has|have)\s+(?:won|received|earned)\b[^.!?]{0,80}\bawards?\b/iu,
  },
  {
    category: "external research",
    pattern:
      /\bexternal research\s+(?:confirms?|shows?|indicates?|establishes?|verifies?|found)\b/iu,
  },
  {
    category: "website verification",
    pattern:
      /\b(?:the\s+)?website\s+(?:was|is|has\s+been)\s+verified\b/iu,
  },
  {
    category: "social-media verification",
    pattern:
      /\b(?:the\s+)?social[- ]media(?:\s+presence)?\s+(?:was|is|has\s+been)\s+verified\b/iu,
  },
];
const suggestionPattern =
  /^(?:consider|review|explore|verify|assess|clarify|confirm|discuss|evaluate)\b/i;

function joinedGroundingText(output: CompanyIntelligence): string {
  return [output.summary, ...output.businessSignals].join(" ");
}

function joinedProseText(output: CompanyIntelligence): string {
  return [
    output.summary,
    ...output.businessSignals,
    ...output.dataQualityGaps,
    ...output.recommendedNextSteps,
  ].join(" ");
}

function inventedFactFailures(
  company: CompanyIntelligenceProjection,
  output: CompanyIntelligence,
): string[] {
  const prose = joinedProseText(output);
  const failures = globalInventedFactPatterns
    .filter(({ pattern }) => pattern.test(prose))
    .map(({ category }) => `invented fact: ${category}`);

  if (
    company.estimatedBranchCount === null &&
    /\b\d+\s+(?:branches|locations|properties|offices)\b/iu.test(prose)
  ) {
    failures.push("invented fact: exact branch count");
  }

  return failures;
}

function semanticFailures(testCase: QualityCase): string[] {
  const failures: string[] = [];
  const groundingText = joinedGroundingText(testCase.output);
  const proseText = joinedProseText(testCase.output);
  const gaps = testCase.output.dataQualityGaps.join(" ");

  failures.push(...inventedFactFailures(testCase.company, testCase.output));

  for (const concept of testCase.expectedSummaryConcepts) {
    if (!concept.test(groundingText)) {
      failures.push(`missing grounded concept ${concept}`);
    }
  }
  for (const concept of testCase.forbiddenGroundingConcepts) {
    if (concept.test(proseText)) {
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
    if (containsDirectCrmOrContactCommand(recommendation)) {
      failures.push(`CRM mutation command: ${recommendation}`);
    }
  }
  if (!testCase.acceptableConfidence.includes(testCase.output.confidence)) {
    failures.push(`miscalibrated confidence ${testCase.output.confidence}`);
  }
  return failures;
}

const hallucinationControls = [
  ["named customer", "McDonald’s is a customer."],
  [
    "campaign",
    "The Ramadan Mega Sale campaign delivered strong engagement.",
  ],
  ["numeric employee count", "The company has 50 employees."],
  ["written-number employee count", "The company employs fifty employees."],
  ["revenue", "Annual revenue is RM10 million."],
  ["market share", "The Company has leading market share."],
  ["awards", "The Company has won multiple industry awards."],
  ["external research", "External research confirms regional leadership."],
  ["website verification", "The website was verified yesterday."],
  ["social-media verification", "The social-media presence was verified."],
  [
    "recommendation-field revenue",
    "Consider using its RM10 million annual revenue in outreach.",
  ],
  ["exact branch count", "The Company operates 12 branches."],
] as const;

const proseLocations = [
  "summary",
  "businessSignals",
  "dataQualityGaps",
  "recommendedNextSteps",
] as const;

function injectProse(
  output: CompanyIntelligence,
  location: (typeof proseLocations)[number],
  value: string,
): CompanyIntelligence {
  if (location === "summary") return { ...output, summary: value };
  return { ...output, [location]: [value] };
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

  it.each(
    hallucinationControls.flatMap(([category, value]) =>
      proseLocations.map((location) => ({ category, value, location })),
    ),
  )(
    "detects $category when injected into $location",
    ({ value, location }) => {
      const sparse = matrix.find(({ id }) => id === "B")!;
      const output = injectProse(sparse.output, location, value);

      expect(inventedFactFailures(sparse.company, output)).not.toEqual([]);
      expect(semanticFailures({ ...sparse, output })).not.toEqual([]);
    },
  );
});
