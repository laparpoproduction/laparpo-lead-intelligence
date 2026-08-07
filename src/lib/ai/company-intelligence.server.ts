import {
  ApplicationConfigurationError,
  getApplicationMode,
  getServerEnv,
  resolveAuthenticatedE2EEnvironment,
} from "@/lib/env";
import { DeterministicE2ECompanyIntelligenceProvider } from "./company-intelligence.e2e-provider";
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
  const applicationMode = getApplicationMode();
  const e2eResolution = resolveAuthenticatedE2EEnvironment({
    nodeEnv: process.env.NODE_ENV,
    applicationMode,
    authenticatedE2E: env.LAPARPO_AUTHENTICATED_E2E,
    aiStub: env.LAPARPO_E2E_AI_STUB,
    aiStubCallsFile: env.LAPARPO_E2E_AI_STUB_CALLS_FILE,
  });
  if (e2eResolution.issues.length > 0) {
    throw new ApplicationConfigurationError(e2eResolution.issues);
  }
  if (applicationMode !== "configured") return null;
  if (e2eResolution.enabled) {
    return new CompanyIntelligenceService(
      new DeterministicE2ECompanyIntelligenceProvider(
        env.LAPARPO_E2E_AI_STUB_CALLS_FILE!,
      ),
      DEFAULT_COMPANY_INTELLIGENCE_MODEL,
    );
  }
  if (!env.OPENAI_API_KEY) return null;

  return new CompanyIntelligenceService(
    new OpenAICompanyIntelligenceProvider(env.OPENAI_API_KEY),
    resolveCompanyIntelligenceModel(env.OPENAI_MODEL),
  );
}
