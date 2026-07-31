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

export type CompanyIntelligence = {
  summary: string;
  businessSignals: string[];
  dataQualityGaps: string[];
  recommendedNextSteps: string[];
  confidence: "low" | "medium" | "high";
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
