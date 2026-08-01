import type { CompanyType } from "@/lib/companies/company.types";

export const companyIntelligenceModelValues = [
  "gpt-5.6-terra",
  "gpt-5.6-luna",
] as const;

export type CompanyIntelligenceModel =
  (typeof companyIntelligenceModelValues)[number];

export type CompanyIntelligenceProjection = {
  legalName: string;
  displayName: string;
  companyType: CompanyType;
  industry: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  country: string;
  estimatedBranchCount: number | null;
  websiteUrl: string | null;
  sourceUrl: string;
  sourceType: string;
};

export const companyEvidenceFieldValues = [
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
] as const;

export type CompanyEvidenceField =
  (typeof companyEvidenceFieldValues)[number];

/** Describes only the completeness of the supplied public metadata. */
export const profileAssessmentCodeValues = [
  "well_populated_public_profile",
  "partially_populated_public_profile",
  "sparse_public_profile",
] as const;

export type ProfileAssessmentCode =
  (typeof profileAssessmentCodeValues)[number];

/** Signals are grounded classifications or metadata-presence observations. */
export const businessSignalCodeValues = [
  "fnb_business_profile",
  "agency_business_profile",
  "hotel_hospitality_profile",
  "other_business_profile",
  "public_description_present",
  "public_website_recorded",
  "location_recorded",
  "branch_count_recorded",
  "potential_content_partnership_fit",
  "potential_production_partner_fit",
] as const;

export type BusinessSignalCode =
  (typeof businessSignalCodeValues)[number];

/** A gap can name only a missing or invalid field in the GREEN projection. */
export const companyGapFieldValues = [
  "industry",
  "description",
  "city",
  "state",
  "country",
  "estimatedBranchCount",
  "websiteUrl",
  "sourceUrl",
  "sourceType",
] as const;

export type CompanyGapField = (typeof companyGapFieldValues)[number];

/** Recommendations are non-binding review or clarification categories only. */
export const recommendationCodeValues = [
  "review_public_company_profile",
  "clarify_industry",
  "clarify_location",
  "verify_branch_count_manually",
  "review_public_positioning",
  "assess_content_partnership_fit",
  "assess_production_partnership_fit",
  "review_available_public_provenance",
] as const;

export type RecommendationCode =
  (typeof recommendationCodeValues)[number];

export const companyIntelligenceConfidenceValues = [
  "low",
  "medium",
] as const;

export type CompanyIntelligenceConfidence =
  (typeof companyIntelligenceConfidenceValues)[number];

export type EvidenceBoundCode<TCode extends string> = {
  code: TCode;
  evidenceFields: CompanyEvidenceField[];
};

/** The complete provider-controlled contract. It intentionally contains no prose. */
export type CompanyIntelligenceStructuredOutput = {
  profileAssessment: EvidenceBoundCode<ProfileAssessmentCode>;
  businessSignals: EvidenceBoundCode<BusinessSignalCode>[];
  dataQualityGaps: CompanyGapField[];
  recommendedNextSteps: EvidenceBoundCode<RecommendationCode>[];
};

/** Trusted application output after structural evidence validation. */
export type ValidatedCompanyIntelligenceOutput =
  CompanyIntelligenceStructuredOutput & {
    confidence: CompanyIntelligenceConfidence;
  };

/** Application-rendered, user-visible text. The model never supplies these strings. */
export type CompanyIntelligence = {
  summary: string;
  businessSignals: string[];
  dataQualityGaps: string[];
  recommendedNextSteps: string[];
  confidence: CompanyIntelligenceConfidence;
};

export type CompanyIntelligenceUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type CompanyIntelligenceProviderRequest = {
  model: CompanyIntelligenceModel;
  input: [
    { role: "developer"; content: string },
    { role: "user"; content: string },
  ];
  maxOutputTokens: number;
  store: false;
};

export type CompanyIntelligenceProviderResult = {
  output: unknown;
  usage: CompanyIntelligenceUsage | null;
};

export interface CompanyIntelligenceProvider {
  generate(
    request: CompanyIntelligenceProviderRequest,
  ): Promise<CompanyIntelligenceProviderResult>;
}
