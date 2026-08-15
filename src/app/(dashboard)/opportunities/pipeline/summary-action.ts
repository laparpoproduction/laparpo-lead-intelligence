"use server";

import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { consumeAiActorRateLimit } from "@/lib/ai/ai-actor-rate-limit";
import {
  deriveOpenAiSafetyIdentifier,
  getAiControlConfiguration,
} from "@/lib/ai/ai-control";
import {
  deriveAiOperationalActorId,
  emitAiOperationalEvent,
  type AiOperationalLogLevel,
  type AiOperationalTelemetry,
} from "@/lib/ai/ai-observability";
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
import {
  OpportunityListUnavailableError,
} from "@/lib/opportunities/opportunity.service";
import {
  createOpportunityContext,
  LeadConversionAuthError,
} from "@/lib/opportunities/opportunity.server";
import type { OpportunityPipelineSummaryActionState } from "./summary-state";

const operation = "opportunity_pipeline_summary" as const;

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
    ai_disabled: "Opportunity pipeline summarization is currently disabled.",
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
  level: AiOperationalLogLevel,
  requestId: string,
  startedAt: number,
  outcome: AiOperationalTelemetry["outcome"],
  context: Omit<
    AiOperationalTelemetry,
    "requestId" | "operation" | "durationMs" | "outcome"
  >,
) {
  emitAiOperationalEvent(level, {
    operation,
    outcome,
    requestId,
    durationMs: Date.now() - startedAt,
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
    logOutcome("warn", requestId, startedAt, "invalid_configuration", {
      providerKind: "unavailable",
      rateLimitOutcome: "not_checked",
      providerStatus: "not_called",
    });
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
      logOutcome("warn", requestId, startedAt, "unauthorized", {
        rateLimitOutcome: "not_checked",
        providerStatus: "not_called",
      });
      return safeFailure(status);
    }
    logOutcome("error", requestId, startedAt, "provider_error", {
      rateLimitOutcome: "not_checked",
      providerStatus: "not_called",
    });
    return safeFailure("unexpected");
  }

  const { actor, service } = context;
  const aiConfiguration = getAiControlConfiguration();
  if (aiConfiguration.status !== "enabled") {
    const status =
      aiConfiguration.status === "disabled" ? "ai_disabled" : "ai_not_configured";
    logOutcome(
      "warn",
      requestId,
      startedAt,
      aiConfiguration.status === "disabled"
        ? "disabled"
        : "invalid_configuration",
      {
        providerKind: "unavailable",
        rateLimitOutcome: "not_checked",
        providerStatus: "not_called",
      },
    );
    return safeFailure(status);
  }
  let actorOperationalId: string;
  try {
    actorOperationalId = deriveAiOperationalActorId(
      actor.userId,
      aiConfiguration.observabilitySecret,
    );
  } catch {
    logOutcome("error", requestId, startedAt, "invalid_configuration", {
      providerKind: "unavailable",
      rateLimitOutcome: "not_checked",
      providerStatus: "not_called",
    });
    return safeFailure("ai_not_configured");
  }
  const safetyIdentifier = deriveOpenAiSafetyIdentifier(
    actor.userId,
    aiConfiguration.identitySecret,
  );
  try {
    const rateLimit = await consumeAiActorRateLimit();
    if (!rateLimit.allowed) {
      logOutcome("warn", requestId, startedAt, "rate_limited", {
        actorOperationalId,
        model: aiConfiguration.model,
        providerKind: aiConfiguration.providerKind,
        rateLimitOutcome: "denied",
        providerStatus: "not_called",
      });
      return safeFailure("rate_limited");
    }
  } catch {
    logOutcome("error", requestId, startedAt, "provider_unavailable", {
      actorOperationalId,
      model: aiConfiguration.model,
      providerKind: aiConfiguration.providerKind,
      rateLimitOutcome: "unavailable",
      providerStatus: "not_called",
    });
    return safeFailure("provider_unavailable");
  }

  try {
    const summaryService = createOpportunityPipelineSummaryService(
      aiConfiguration,
      safetyIdentifier,
    );
    const now = new Date();
    const readModel = await service.getPipelineSummaryReadModel(actor, now);
    const projection = projectOpportunityPipelineSummary(
      readModel,
      actor.userId,
      now,
    );
    const generated = await summaryService.generate(projection);
    logOutcome("info", requestId, startedAt, "success", {
      actorOperationalId,
      inputCandidateCount:
        projection.providerSnapshot.analyzedCandidateCount,
      model: generated.model,
      providerKind: aiConfiguration.providerKind,
      rateLimitOutcome: "allowed",
      providerStatus: "succeeded",
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
      logOutcome("warn", requestId, startedAt, "invalid_input", {
        actorOperationalId,
        model: aiConfiguration.model,
        providerKind: aiConfiguration.providerKind,
        rateLimitOutcome: "allowed",
        providerStatus: "not_called",
      });
      return safeFailure("validation_error");
    }
    if (error instanceof OpportunityListUnavailableError) {
      logOutcome("warn", requestId, startedAt, "provider_unavailable", {
        actorOperationalId,
        model: aiConfiguration.model,
        providerKind: aiConfiguration.providerKind,
        rateLimitOutcome: "allowed",
        providerStatus: "not_called",
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
      const refusal = error instanceof PipelineSummaryProviderRefusalError;
      logOutcome(
        "warn",
        requestId,
        startedAt,
        refusal ? "provider_refusal" : "provider_output_invalid",
        {
          actorOperationalId,
          model: aiConfiguration.model,
          providerKind: aiConfiguration.providerKind,
          rateLimitOutcome: "allowed",
          providerStatus: refusal ? "refusal" : "output_invalid",
        },
      );
      return safeFailure("invalid_model_output");
    }
    if (error instanceof PipelineSummaryProviderError) {
      logOutcome(
        "warn",
        requestId,
        startedAt,
        error.code === "timeout" ? "provider_timeout" : "provider_unavailable",
        {
          actorOperationalId,
          model: aiConfiguration.model,
          providerKind: aiConfiguration.providerKind,
          rateLimitOutcome: "allowed",
          providerStatus: error.code === "timeout" ? "timeout" : "unavailable",
        },
      );
      return safeFailure(
        error.code === "timeout"
          ? "timeout"
          : error.code === "rate_limited"
            ? "rate_limited"
            : "provider_unavailable",
      );
    }
    logOutcome("error", requestId, startedAt, "provider_error", {
      actorOperationalId,
      model: aiConfiguration.model,
      providerKind: aiConfiguration.providerKind,
      rateLimitOutcome: "allowed",
      providerStatus: "error",
    });
    return safeFailure("unexpected");
  }
}
