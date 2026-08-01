import type {
  BusinessSignalCode,
  CompanyEvidenceField,
  CompanyGapField,
  CompanyIntelligenceConfidence,
  CompanyIntelligenceProjection,
  CompanyIntelligenceStructuredOutput,
  ProfileAssessmentCode,
  RecommendationCode,
  ValidatedCompanyIntelligenceOutput,
} from "./company-intelligence.types";

export class CompanyIntelligenceEvidenceError extends Error {
  constructor() {
    super("Company intelligence output is not grounded in the supplied metadata");
    this.name = "CompanyIntelligenceEvidenceError";
  }
}

function hasText(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function isHttpUrl(value: string | null): value is string {
  if (!hasText(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isUsableCompanyEvidenceField(
  company: CompanyIntelligenceProjection,
  field: CompanyEvidenceField,
): boolean {
  switch (field) {
    case "companyType":
      return ["fnb", "agency", "hotel", "other"].includes(company.companyType);
    case "estimatedBranchCount":
      return (
        Number.isInteger(company.estimatedBranchCount) &&
        company.estimatedBranchCount !== null &&
        company.estimatedBranchCount >= 0 &&
        company.estimatedBranchCount <= 100_000
      );
    case "websiteUrl":
      return isHttpUrl(company.websiteUrl);
    case "sourceUrl":
      return isHttpUrl(company.sourceUrl);
    case "country":
      return /^[A-Z]{2}$/u.test(company.country);
    default:
      return hasText(company[field]);
  }
}

function unique<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

function includesAll<T>(values: readonly T[], required: readonly T[]): boolean {
  return required.every((value) => values.includes(value));
}

function validateEvidenceFields(
  company: CompanyIntelligenceProjection,
  evidenceFields: readonly CompanyEvidenceField[],
  allowed: readonly CompanyEvidenceField[],
  required: readonly CompanyEvidenceField[],
): boolean {
  return (
    unique(evidenceFields) &&
    includesAll(evidenceFields, required) &&
    evidenceFields.every(
      (field) =>
        allowed.includes(field) && isUsableCompanyEvidenceField(company, field),
    )
  );
}

const profileEvidenceFields: readonly CompanyEvidenceField[] = [
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
];

function expectedProfileAssessment(
  company: CompanyIntelligenceProjection,
): ProfileAssessmentCode {
  const completenessSignals = [
    isUsableCompanyEvidenceField(company, "industry"),
    isUsableCompanyEvidenceField(company, "description"),
    ["city", "state", "country"].every((field) =>
      isUsableCompanyEvidenceField(company, field as CompanyEvidenceField),
    ),
    isUsableCompanyEvidenceField(company, "websiteUrl"),
    ["sourceUrl", "sourceType"].every((field) =>
      isUsableCompanyEvidenceField(company, field as CompanyEvidenceField),
    ),
  ];
  const populated = completenessSignals.filter(Boolean).length;

  if (populated === completenessSignals.length) {
    return "well_populated_public_profile";
  }
  if (populated <= 1) return "sparse_public_profile";
  return "partially_populated_public_profile";
}

function signalIsGrounded(
  company: CompanyIntelligenceProjection,
  code: BusinessSignalCode,
  evidenceFields: readonly CompanyEvidenceField[],
): boolean {
  const categoryRules: Partial<Record<BusinessSignalCode, string>> = {
    fnb_business_profile: "fnb",
    agency_business_profile: "agency",
    hotel_hospitality_profile: "hotel",
    other_business_profile: "other",
  };
  const category = categoryRules[code];
  if (category) {
    return (
      company.companyType === category &&
      validateEvidenceFields(
        company,
        evidenceFields,
        ["companyType", "industry", "description"],
        ["companyType"],
      )
    );
  }

  switch (code) {
    case "public_description_present":
      return validateEvidenceFields(
        company,
        evidenceFields,
        ["description"],
        ["description"],
      );
    case "public_website_recorded":
      return validateEvidenceFields(
        company,
        evidenceFields,
        ["websiteUrl"],
        ["websiteUrl"],
      );
    case "location_recorded":
      return validateEvidenceFields(
        company,
        evidenceFields,
        ["city", "state", "country"],
        ["city", "state", "country"],
      );
    case "branch_count_recorded":
      return validateEvidenceFields(
        company,
        evidenceFields,
        ["estimatedBranchCount"],
        ["estimatedBranchCount"],
      );
    case "potential_content_partnership_fit":
      return (
        ["fnb", "hotel"].includes(company.companyType) &&
        validateEvidenceFields(
          company,
          evidenceFields,
          ["companyType", "industry", "description"],
          ["companyType"],
        )
      );
    case "potential_production_partner_fit":
      return (
        company.companyType === "agency" &&
        validateEvidenceFields(
          company,
          evidenceFields,
          ["companyType", "industry", "description"],
          ["companyType"],
        )
      );
  }

  return false;
}

function recommendationIsGrounded(
  company: CompanyIntelligenceProjection,
  gaps: readonly CompanyGapField[],
  code: RecommendationCode,
  evidenceFields: readonly CompanyEvidenceField[],
): boolean {
  switch (code) {
    case "review_public_company_profile":
      return validateEvidenceFields(
        company,
        evidenceFields,
        ["legalName", "displayName", "companyType"],
        ["displayName"],
      );
    case "clarify_industry":
      return (
        gaps.includes("industry") &&
        !isUsableCompanyEvidenceField(company, "industry") &&
        validateEvidenceFields(
          company,
          evidenceFields,
          ["companyType", "description"],
          ["companyType"],
        )
      );
    case "clarify_location":
      return (
        ["city", "state", "country"].some((field) =>
          gaps.includes(field as CompanyGapField),
        ) &&
        validateEvidenceFields(
          company,
          evidenceFields,
          ["companyType", "city", "state", "country"],
          ["companyType"],
        )
      );
    case "verify_branch_count_manually":
      return validateEvidenceFields(
        company,
        evidenceFields,
        ["estimatedBranchCount"],
        ["estimatedBranchCount"],
      );
    case "review_public_positioning":
      return (
        evidenceFields.some((field) =>
          ["description", "websiteUrl"].includes(field),
        ) &&
        validateEvidenceFields(
          company,
          evidenceFields,
          ["description", "websiteUrl"],
          [],
        )
      );
    case "assess_content_partnership_fit":
      return (
        ["fnb", "hotel"].includes(company.companyType) &&
        validateEvidenceFields(
          company,
          evidenceFields,
          ["companyType", "industry", "description"],
          ["companyType"],
        )
      );
    case "assess_production_partnership_fit":
      return (
        company.companyType === "agency" &&
        validateEvidenceFields(
          company,
          evidenceFields,
          ["companyType", "industry", "description"],
          ["companyType"],
        )
      );
    case "review_available_public_provenance":
      return validateEvidenceFields(
        company,
        evidenceFields,
        ["sourceUrl", "sourceType"],
        ["sourceType"],
      );
  }
}

export function deriveCompanyIntelligenceConfidence(
  profileCode: ProfileAssessmentCode,
): CompanyIntelligenceConfidence {
  return profileCode === "sparse_public_profile" ? "low" : "medium";
}

export function validateCompanyIntelligenceEvidence(
  company: CompanyIntelligenceProjection,
  output: CompanyIntelligenceStructuredOutput,
): ValidatedCompanyIntelligenceOutput {
  const profileValid =
    output.profileAssessment.code === expectedProfileAssessment(company) &&
    validateEvidenceFields(
      company,
      output.profileAssessment.evidenceFields,
      profileEvidenceFields,
      ["companyType"],
    );

  const uniqueSignalCodes = unique(
    output.businessSignals.map(({ code }) => code),
  );
  const signalsValid = output.businessSignals.every(({ code, evidenceFields }) =>
    signalIsGrounded(company, code, evidenceFields),
  );

  const uniqueGaps = unique(output.dataQualityGaps);
  const gapsValid = output.dataQualityGaps.every(
    (field) => !isUsableCompanyEvidenceField(company, field),
  );

  const uniqueRecommendationCodes = unique(
    output.recommendedNextSteps.map(({ code }) => code),
  );
  const recommendationsValid = output.recommendedNextSteps.every(
    ({ code, evidenceFields }) =>
      recommendationIsGrounded(
        company,
        output.dataQualityGaps,
        code,
        evidenceFields,
      ),
  );

  if (
    !profileValid ||
    !uniqueSignalCodes ||
    !signalsValid ||
    !uniqueGaps ||
    !gapsValid ||
    !uniqueRecommendationCodes ||
    !recommendationsValid
  ) {
    throw new CompanyIntelligenceEvidenceError();
  }

  return {
    ...output,
    confidence: deriveCompanyIntelligenceConfidence(
      output.profileAssessment.code,
    ),
  };
}
