"use server";

import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import {
  AiActorRateLimitUnavailableError,
  consumeAiActorRateLimit,
} from "@/lib/ai/ai-actor-rate-limit";
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
import { logger } from "@/lib/logger";
import type { CompanyIntelligenceActionState } from "./intelligence-state";

const operation = "generate_company_intelligence";

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
    rate_limited: "Please wait before generating another recommendation.",
    timeout: "The AI provider took too long to respond. Try again later.",
    provider_unavailable: "Company intelligence is temporarily unavailable.",
    invalid_model_output: "The AI response could not be validated. No result was shown.",
    unexpected: "Company intelligence could not be generated.",
  };
  return { status, message: messages[status] };
}

function logOutcome(
  level: "info" | "warn" | "error",
  requestId: string,
  outcome: string,
  context: Record<string, string | number | null | undefined> = {},
): void {
  logger[level]("Company intelligence generation", {
    operation,
    outcome,
    requestId,
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
    logOutcome("warn", requestId, "unavailable_mode");
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
      logOutcome("warn", requestId, error.code);
      return safeFailure(status);
    }
    logOutcome("error", requestId, "authentication_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return safeFailure("unexpected");
  }

  const { actor, service: companyService } = context;
  try {
    const rateLimit = await consumeAiActorRateLimit();
    if (!rateLimit.allowed) {
      logOutcome("warn", requestId, "rate_limited", {
        actorId: actor.userId,
      });
      return safeFailure("rate_limited");
    }
  } catch (error) {
    logOutcome("error", requestId, "rate_limiter_unavailable", {
      actorId: actor.userId,
      errorName:
        error instanceof AiActorRateLimitUnavailableError
          ? error.name
          : "UnknownError",
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
    logOutcome("warn", requestId, "invalid_target", {
      actorId: actor.userId,
    });
    return safeFailure("not_found");
  }

  try {
    const company = await companyService.getById(companyId, actor);
    const projection = projectCompanyForIntelligence(company);
    const intelligenceService = createCompanyIntelligenceService();

    if (!intelligenceService) {
      logOutcome("warn", requestId, "not_configured", {
        actorId: actor.userId,
        companyId,
      });
      return safeFailure("ai_not_configured");
    }

    const generated = await intelligenceService.generate(projection);
    logOutcome("info", requestId, "succeeded", {
      actorId: actor.userId,
      companyId,
      durationMs: Date.now() - startedAt,
      model: generated.model,
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
      logOutcome("warn", requestId, "not_found", {
        actorId: actor.userId,
        companyId,
      });
      return safeFailure("not_found");
    }
    if (error instanceof CompanyIntelligenceInputTooLargeError) {
      logOutcome("warn", requestId, "input_rejected", {
        actorId: actor.userId,
        companyId,
        limitCategory: error.category,
        actualSize: error.actualSize,
        limit: error.limit,
      });
      return safeFailure("validation_error");
    }
    if (
      error instanceof InvalidCompanyIntelligenceOutputError ||
      error instanceof ZodError ||
      error instanceof SyntaxError
    ) {
      logOutcome("warn", requestId, "invalid_model_output", {
        actorId: actor.userId,
        companyId,
      });
      return safeFailure("invalid_model_output");
    }
    if (error instanceof CompanyIntelligenceProviderRefusalError) {
      logOutcome("warn", requestId, "provider_refusal", {
        actorId: actor.userId,
        companyId,
      });
      return safeFailure("invalid_model_output");
    }
    if (error instanceof CompanyIntelligenceProviderError) {
      logOutcome("warn", requestId, error.code, {
        actorId: actor.userId,
        companyId,
      });
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
      companyId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return safeFailure("unexpected");
  }
}
