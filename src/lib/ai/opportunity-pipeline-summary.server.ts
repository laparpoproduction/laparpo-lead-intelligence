import {
  ApplicationConfigurationError,
  getApplicationMode,
  getServerEnv,
  resolveAuthenticatedE2EEnvironment,
} from "@/lib/env";
import {
  DEFAULT_COMPANY_INTELLIGENCE_MODEL,
  resolveCompanyIntelligenceModel,
} from "./company-intelligence.server";
import { DeterministicE2EPipelineSummaryProvider } from "./opportunity-pipeline-summary.e2e-provider";
import { OpenAIPipelineSummaryProvider } from "./opportunity-pipeline-summary.provider";
import { OpportunityPipelineSummaryService } from "./opportunity-pipeline-summary.service";

export function createOpportunityPipelineSummaryService(): OpportunityPipelineSummaryService | null {
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
    return new OpportunityPipelineSummaryService(
      new DeterministicE2EPipelineSummaryProvider(
        env.LAPARPO_E2E_AI_STUB_CALLS_FILE!,
      ),
      DEFAULT_COMPANY_INTELLIGENCE_MODEL,
    );
  }
  if (!env.OPENAI_API_KEY) return null;
  return new OpportunityPipelineSummaryService(
    new OpenAIPipelineSummaryProvider(env.OPENAI_API_KEY),
    resolveCompanyIntelligenceModel(env.OPENAI_MODEL),
  );
}
