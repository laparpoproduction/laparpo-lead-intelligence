import "server-only";

import {
  DEFAULT_AI_MODEL,
  type AiControlConfiguration,
} from "./ai-control";
import {
  companyIntelligenceModelValues,
  type CompanyIntelligenceModel,
} from "./company-intelligence.types";
import { DeterministicE2ECompanyIntelligenceProvider } from "./company-intelligence.e2e-provider";
import { OpenAICompanyIntelligenceProvider } from "./company-intelligence.provider";
import { CompanyIntelligenceService } from "./company-intelligence.service";

export const DEFAULT_COMPANY_INTELLIGENCE_MODEL = DEFAULT_AI_MODEL;

export function resolveCompanyIntelligenceModel(
  value: string | undefined,
): CompanyIntelligenceModel {
  if (value === undefined) return DEFAULT_AI_MODEL;
  if (
    companyIntelligenceModelValues.includes(value as CompanyIntelligenceModel)
  ) {
    return value as CompanyIntelligenceModel;
  }
  throw new TypeError("Invalid OpenAI model configuration");
}

export function createCompanyIntelligenceService(
  configuration: Extract<AiControlConfiguration, { status: "enabled" }>,
  safetyIdentifier: string,
): CompanyIntelligenceService {
  if (configuration.providerKind === "deterministic-e2e") {
    return new CompanyIntelligenceService(
      new DeterministicE2ECompanyIntelligenceProvider(
        configuration.deterministicCallsFile!,
      ),
      configuration.model,
    );
  }
  return new CompanyIntelligenceService(
    new OpenAICompanyIntelligenceProvider(
      configuration.openAiApiKey!,
      undefined,
      safetyIdentifier,
    ),
    configuration.model,
  );
}
