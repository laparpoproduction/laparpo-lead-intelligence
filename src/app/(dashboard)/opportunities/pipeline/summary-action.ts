"use server";

import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { controlledAiActorRateLimiter } from "@/lib/ai/company-intelligence.rate-limit";
import { PipelineSummaryInputTooLargeError } from "@/lib/ai/opportunity-pipeline-summary.input";
import { projectOpportunityPipelineSummary } from "@/lib/ai/opportunity-pipeline-summary.projection";
import {
  PipelineSummaryProviderError,
  PipelineSummaryProviderRefusalError,
} from "@/lib/ai/opportunity-pipeline-summary.provider";
import { InvalidPipelineSummaryRenderError } from "@/lib/ai/opportunity-pipeline-summary.render";
import { createOpportunityPipelineSummaryService } from "@/lib/ai/opportunity-pipeline-summary.server";
import { InvalidPipelineSummaryOutputError } from "@/lib/ai/opportunity-pipeline-summary.validation";
import { getApplicationMode } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  OpportunityListUnavailableError,
} from "@/lib/opportunities/opportunity.service";
import {
  createOpportunityContext,
  LeadConversionAuthError,
} from "@/lib/opportunities/opportunity.server";
import type { OpportunityPipelineSummaryActionState } from "./summary-state";

const operation = "generate_opportunity_pipeline_summary";

function safeFailure(
  status: Exclude<
    OpportunityPipelineSummaryActionState["status"],
    "idle" | "success"
  >,
): OpportunityPipelineSummaryActionState {
  const messages: Record<typeof status, string> = {
    validation_error:
      "The accessible pipeline exceeds the safe AI input limit. No provider request was made.",
    permission_error:
      "Sign in with an active account to summarize the Opportunity pipeline.",
    ai_not_configured:
      "Opportunity pipeline summarization is not configured for this environment.",
    rate_limited: "Please wait before generating another AI summary.",
    timeout: "The AI provider took too long to respond. Try again later.",
    provider_unavailable:
      "Opportunity pipeline summarization is temporarily unavailable.",
    invalid_model_output:
      "The AI response could not be validated. No result was shown.",
    unexpected: "The Opportunity pipeline summary could not be generated.",
  };
  return { status, message: messages[status] };
}

function logOutcome(
  level: "info" | "warn" | "error",
  requestId: string,
  outcome: string,
  context: Record<string, string | number | null | undefined> = {},
) {
  logger[level]("Opportunity pipeline summary generation", {
    operation,
    outcome,
    requestId,
    ...context,
  });
}

export async function generateOpportunityPipelineSummaryAction(
  _state: OpportunityPipelineSummaryActionState,
  _formData: FormData,
): Promise<OpportunityPipelineSummaryActionState> {
  void _state;
  void _formData;
  const requestId = randomUUID();
  const startedAt = Date.now();
  if (getApplicationMode() !== "configured") {
    logOutcome("warn", requestId, "unavailable_mode");
    return safeFailure("ai_not_configured");
  }

  let context: Awaited<ReturnType<typeof createOpportunityContext>>;
  try {
    context = await createOpportunityContext();
  } catch (error) {
    if (error instanceof LeadConversionAuthError) {
      const status =
        error.code === "unauthenticated" || error.code === "inactive"
          ? "permission_error"
          : "provider_unavailable";
      logOutcome("warn", requestId, error.code);
      return safeFailure(status);
    }
    logOutcome("error", requestId, "authentication_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return safeFailure("unexpected");
  }

  const { actor, service } = context;
  try {
    const summaryService = createOpportunityPipelineSummaryService();
    if (!summaryService) {
      logOutcome("warn", requestId, "not_configured", {
        actorId: actor.userId,
      });
      return safeFailure("ai_not_configured");
    }
    if (!controlledAiActorRateLimiter.consume(actor.userId)) {
      logOutcome("warn", requestId, "rate_limited", {
        actorId: actor.userId,
      });
      return safeFailure("rate_limited");
    }

    const now = new Date();
    const readModel = await service.getPipelineSummaryReadModel(actor, now);
    const projection = projectOpportunityPipelineSummary(
      readModel,
      actor.userId,
      now,
    );
    const generated = await summaryService.generate(projection);
    logOutcome("info", requestId, "succeeded", {
      actorId: actor.userId,
      candidateCount: projection.providerSnapshot.analyzedCandidateCount,
      activeCount: projection.providerSnapshot.activeOpportunityCount,
      durationMs: Date.now() - startedAt,
      model: generated.model,
      inputTokens: generated.usage?.inputTokens,
      outputTokens: generated.usage?.outputTokens,
      totalTokens: generated.usage?.totalTokens,
    });
    return {
      status: "success",
      message:
        "AI-assisted priority generated. No CRM data, stages, owners, probabilities or values were changed.",
      summary: generated.summary,
    };
  } catch (error) {
    if (error instanceof PipelineSummaryInputTooLargeError) {
      logOutcome("warn", requestId, "input_rejected", {
        actorId: actor.userId,
        actualBytes: error.actualBytes,
        limitBytes: error.limitBytes,
      });
      return safeFailure("validation_error");
    }
    if (error instanceof OpportunityListUnavailableError) {
      logOutcome("warn", requestId, "pipeline_unavailable", {
        actorId: actor.userId,
      });
      return safeFailure("provider_unavailable");
    }
    if (
      error instanceof InvalidPipelineSummaryOutputError ||
      error instanceof InvalidPipelineSummaryRenderError ||
      error instanceof PipelineSummaryProviderRefusalError ||
      error instanceof ZodError ||
      error instanceof SyntaxError
    ) {
      logOutcome("warn", requestId, "invalid_model_output", {
        actorId: actor.userId,
      });
      return safeFailure("invalid_model_output");
    }
    if (error instanceof PipelineSummaryProviderError) {
      logOutcome("warn", requestId, error.code, { actorId: actor.userId });
      return safeFailure(
        error.code === "timeout"
          ? "timeout"
          : error.code === "rate_limited"
            ? "rate_limited"
            : "provider_unavailable",
      );
    }
    logOutcome("error", requestId, "unexpected", {
      actorId: actor.userId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return safeFailure("unexpected");
  }
}
