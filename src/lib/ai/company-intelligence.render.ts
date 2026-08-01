import type {
  BusinessSignalCode,
  CompanyEvidenceField,
  CompanyGapField,
  CompanyIntelligence,
  CompanyIntelligenceProjection,
  ProfileAssessmentCode,
  RecommendationCode,
  ValidatedCompanyIntelligenceOutput,
} from "./company-intelligence.types";
import { isUsableCompanyEvidenceField } from "./company-intelligence.evidence";

export const profileAssessmentText: Record<ProfileAssessmentCode, string> = {
  well_populated_public_profile:
    "The public Company profile contains the main metadata used for this assessment.",
  partially_populated_public_profile:
    "The public Company profile contains some, but not all, metadata used for this assessment.",
  sparse_public_profile:
    "The public Company profile contains limited metadata for this assessment.",
};

export const businessSignalText: Record<BusinessSignalCode, string> = {
  fnb_business_profile:
    "The supplied Company type identifies an F&B business profile.",
  agency_business_profile:
    "The supplied Company type identifies an agency business profile.",
  hotel_hospitality_profile:
    "The supplied Company type identifies a hotel or hospitality business profile.",
  other_business_profile:
    "The supplied Company type identifies another business profile category.",
  public_description_present: "A public business description is recorded.",
  public_website_recorded: "A public website record is available.",
  location_recorded: "City, state and country information are recorded.",
  branch_count_recorded: "An estimated branch count is recorded.",
  potential_content_partnership_fit:
    "The supplied business category may be relevant to a content-partnership assessment.",
  potential_production_partner_fit:
    "The supplied agency profile may be relevant to a production-partnership assessment.",
};

export const dataQualityGapText: Record<CompanyGapField, string> = {
  industry: "Industry information is not recorded.",
  description: "A public business description is not recorded.",
  city: "City information is not recorded.",
  state: "State information is not recorded.",
  country: "Country information is not recorded or valid.",
  estimatedBranchCount: "An estimated branch count is not recorded.",
  websiteUrl: "A valid public website record is not available.",
  sourceUrl: "A valid public provenance source is not available.",
  sourceType: "The public provenance type is not recorded.",
};

export const recommendationText: Record<RecommendationCode, string> = {
  review_public_company_profile:
    "Consider reviewing the available public Company profile.",
  clarify_industry: "Consider clarifying the Company’s industry.",
  clarify_location: "Consider clarifying the Company’s location information.",
  verify_branch_count_manually:
    "Consider manually reviewing the recorded estimated branch count.",
  review_public_positioning:
    "Consider reviewing the Company’s available public positioning.",
  assess_content_partnership_fit:
    "Consider assessing potential content-partnership fit.",
  assess_production_partnership_fit:
    "Consider assessing potential production-partnership fit.",
  review_available_public_provenance:
    "Consider reviewing the available public provenance record.",
};

const companyTypeText = {
  fnb: "an F&B Company",
  agency: "an agency",
  hotel: "a hotel or hospitality Company",
  other: "a Company in another business category",
} as const;

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function renderCompanyIntelligenceSummary(
  company: CompanyIntelligenceProjection,
  profileCode: ProfileAssessmentCode,
): string {
  const industry = isUsableCompanyEvidenceField(company, "industry");
  const location = ["city", "state", "country"].every((field) =>
    isUsableCompanyEvidenceField(company, field as CompanyEvidenceField),
  );
  const recorded = [
    industry ? "an industry" : null,
    isUsableCompanyEvidenceField(company, "description")
      ? "a description"
      : null,
    location ? "a location" : null,
    isUsableCompanyEvidenceField(company, "websiteUrl")
      ? "a public website record"
      : null,
    isUsableCompanyEvidenceField(company, "estimatedBranchCount")
      ? "an estimated branch count"
      : null,
  ].filter((value): value is string => value !== null);

  const completenessLead: Record<ProfileAssessmentCode, string> = {
    well_populated_public_profile: "The available public metadata describes",
    partially_populated_public_profile:
      "The available public metadata partially describes",
    sparse_public_profile: "The limited public metadata records",
  };
  const recordedText =
    recorded.length > 0
      ? ` The profile contains ${joinList(recorded)}.`
      : " The profile contains no additional assessment metadata.";

  return `${completenessLead[profileCode]} ${companyTypeText[company.companyType]}.${recordedText}`;
}

export function renderCompanyIntelligence(
  company: CompanyIntelligenceProjection,
  output: ValidatedCompanyIntelligenceOutput,
): CompanyIntelligence {
  return {
    summary: renderCompanyIntelligenceSummary(
      company,
      output.profileAssessment.code,
    ),
    businessSignals: output.businessSignals.map(
      ({ code }) => businessSignalText[code],
    ),
    dataQualityGaps: output.dataQualityGaps.map(
      (field) => dataQualityGapText[field],
    ),
    recommendedNextSteps: output.recommendedNextSteps.map(
      ({ code }) => recommendationText[code],
    ),
    confidence: output.confidence,
  };
}
