import type { Company } from "@/lib/companies/company.types";
import type { CompanyIntelligenceProjection } from "./company-intelligence.types";

export function projectCompanyForIntelligence(
  company: Company,
): CompanyIntelligenceProjection {
  return {
    legalName: company.legalName,
    displayName: company.displayName,
    companyType: company.companyType,
    industry: company.industry,
    description: company.description,
    city: company.city,
    state: company.state,
    country: company.country,
    estimatedBranchCount: company.estimatedBranchCount,
    // URLs are opaque, untrusted provenance strings. Phase 1A never fetches them.
    websiteUrl: company.websiteUrl,
    sourceUrl: company.sourceUrl,
    sourceType: company.sourceType,
  };
}
