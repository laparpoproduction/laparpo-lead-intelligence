import "server-only";

import type { AiControlConfiguration } from "./ai-control";
import { DeterministicE2EPipelineSummaryProvider } from "./opportunity-pipeline-summary.e2e-provider";
import { OpenAIPipelineSummaryProvider } from "./opportunity-pipeline-summary.provider";
import { OpportunityPipelineSummaryService } from "./opportunity-pipeline-summary.service";

export function createOpportunityPipelineSummaryService(
  configuration: Extract<AiControlConfiguration, { status: "enabled" }>,
  safetyIdentifier: string,
): OpportunityPipelineSummaryService {
  if (configuration.providerKind === "deterministic-e2e") {
    return new OpportunityPipelineSummaryService(
      new DeterministicE2EPipelineSummaryProvider(
        configuration.deterministicCallsFile!,
      ),
      configuration.model,
    );
  }
  return new OpportunityPipelineSummaryService(
    new OpenAIPipelineSummaryProvider(
      configuration.openAiApiKey!,
      undefined,
      safetyIdentifier,
    ),
    configuration.model,
  );
}
