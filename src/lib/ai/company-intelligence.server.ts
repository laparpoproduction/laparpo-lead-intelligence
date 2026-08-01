import { getServerEnv } from "@/lib/env";
import { OpenAICompanyIntelligenceProvider } from "./company-intelligence.provider";
import { CompanyIntelligenceService } from "./company-intelligence.service";
import {
  companyIntelligenceModelValues,
  type CompanyIntelligenceModel,
} from "./company-intelligence.types";

export const DEFAULT_COMPANY_INTELLIGENCE_MODEL: CompanyIntelligenceModel =
  "gpt-5.6-terra";

export function resolveCompanyIntelligenceModel(
  value: string | undefined,
): CompanyIntelligenceModel {
  return companyIntelligenceModelValues.includes(
    value as CompanyIntelligenceModel,
  )
    ? (value as CompanyIntelligenceModel)
    : DEFAULT_COMPANY_INTELLIGENCE_MODEL;
}

export function createCompanyIntelligenceService(): CompanyIntelligenceService | null {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return null;

  return new CompanyIntelligenceService(
    new OpenAICompanyIntelligenceProvider(env.OPENAI_API_KEY),
    resolveCompanyIntelligenceModel(env.OPENAI_MODEL),
  );
}
