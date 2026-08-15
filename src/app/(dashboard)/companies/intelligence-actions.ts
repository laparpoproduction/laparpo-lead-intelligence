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
import { CompanyIntelligenceInputTooLargeError } from "@/lib/ai/company-intelligence.input";
import {
  CompanyIntelligenceProviderError,
  CompanyIntelligenceProviderRefusalError,
} from "@/lib/ai/company-intelligence.provider";
import { projectCompanyForIntelligence } from "@/lib/ai/company-intelligence.projection";
import { createCompanyIntelligenceService } from "@/lib/ai/company-intelligence.server";
import { InvalidCompanyIntelligenceOutputError } from "@/lib/ai/company-intelligence.service";
import { CompanyRepositoryNotFoundError } from "@/lib/companies/company.repository";
import {
  CompanyNotFoundError,
  CompanyPermissionError,
} from "@/lib/companies/company.service";
import {
  CompanyMutationAuthError,
  createCompanyMutationContext,
} from "@/lib/companies/company.server";
import { validateCompanyId } from "@/lib/companies/company.validation";
import { getApplicationMode } from "@/lib/env";
import type { CompanyIntelligenceActionState } from "./intelligence-state";

const operation = "company_intelligence" as const;

function safeFailure(
  status: Exclude<
    CompanyIntelligenceActionState["status"],
    "idle" | "success"
  >,
): CompanyIntelligenceActionState {
  const messages: Record<typeof status, string> = {
    validation_error:
      "The available Company metadata exceeds the safe AI input limit.",
    permission_error: "Sign in with an active account to use Company intelligence.",
    not_found: "Company intelligence is unavailable for this record.",
    ai_not_configured: "Company intelligence is not configured for this environment.",
    ai_disabled: "Company intelligence is currently disabled.",
    rate_limited: "Please wait before generating another recommendation.",
    timeout: "The AI provider took too long to respond. Try again later.",
    provider_unavailable: "Company intelligence is temporarily unavailable.",
    invalid_model_output: "The AI response could not be validated. No result was shown.",
    unexpected: "Company intelligence could not be generated.",
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
): void {
  emitAiOperationalEvent(level, {
    operation,
    outcome,
    requestId,
    durationMs: Date.now() - startedAt,
    ...context,
  });
}

export async function generateCompanyIntelligenceAction(
  _state: CompanyIntelligenceActionState,
  formData: FormData,
): Promise<CompanyIntelligenceActionState> {
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

  let context: Awaited<ReturnType<typeof createCompanyMutationContext>>;
  try {
    context = await createCompanyMutationContext();
  } catch (error) {
    if (error instanceof CompanyMutationAuthError) {
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

  const { actor, service: companyService } = context;
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

  let companyId: string;
  try {
    const rawCompanyId = formData.get("companyId");
    companyId = validateCompanyId(
      typeof rawCompanyId === "string" ? rawCompanyId : "",
    );
  } catch {
    logOutcome("warn", requestId, startedAt, "invalid_input", {
      actorOperationalId,
      model: aiConfiguration.model,
      providerKind: aiConfiguration.providerKind,
      rateLimitOutcome: "allowed",
      providerStatus: "not_called",
    });
    return safeFailure("not_found");
  }

  try {
    const company = await companyService.getById(companyId, actor);
    const projection = projectCompanyForIntelligence(company);
    const intelligenceService = createCompanyIntelligenceService(
      aiConfiguration,
      safetyIdentifier,
    );

    const generated = await intelligenceService.generate(projection);
    logOutcome("info", requestId, startedAt, "success", {
      actorOperationalId,
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
      message: "AI recommendation generated. No CRM data was changed.",
      intelligence: generated.intelligence,
    };
  } catch (error) {
    if (
      error instanceof CompanyNotFoundError ||
      error instanceof CompanyRepositoryNotFoundError ||
      error instanceof CompanyPermissionError
    ) {
      logOutcome("warn", requestId, startedAt, "not_found", {
        actorOperationalId,
        model: aiConfiguration.model,
        providerKind: aiConfiguration.providerKind,
        rateLimitOutcome: "allowed",
        providerStatus: "not_called",
      });
      return safeFailure("not_found");
    }
    if (error instanceof CompanyIntelligenceInputTooLargeError) {
      logOutcome("warn", requestId, startedAt, "invalid_input", {
        actorOperationalId,
        model: aiConfiguration.model,
        providerKind: aiConfiguration.providerKind,
        rateLimitOutcome: "allowed",
        providerStatus: "not_called",
      });
      return safeFailure("validation_error");
    }
    if (
      error instanceof InvalidCompanyIntelligenceOutputError ||
      error instanceof ZodError ||
      error instanceof SyntaxError
    ) {
      logOutcome("warn", requestId, startedAt, "provider_output_invalid", {
        actorOperationalId,
        model: aiConfiguration.model,
        providerKind: aiConfiguration.providerKind,
        rateLimitOutcome: "allowed",
        providerStatus: "output_invalid",
      });
      return safeFailure("invalid_model_output");
    }
    if (error instanceof CompanyIntelligenceProviderRefusalError) {
      logOutcome("warn", requestId, startedAt, "provider_refusal", {
        actorOperationalId,
        model: aiConfiguration.model,
        providerKind: aiConfiguration.providerKind,
        rateLimitOutcome: "allowed",
        providerStatus: "refusal",
      });
      return safeFailure("invalid_model_output");
    }
    if (error instanceof CompanyIntelligenceProviderError) {
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
