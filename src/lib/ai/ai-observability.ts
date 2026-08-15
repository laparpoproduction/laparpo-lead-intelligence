import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";
import { logger } from "@/lib/logger";

const OPERATIONAL_ACTOR_DOMAIN = "ai-ops:v1:";
const OPERATIONAL_ACTOR_PREFIX = "lai-ops-v1_";
const actorUuidSchema = z.string().uuid();

export const aiOperationValues = [
  "company_intelligence",
  "opportunity_pipeline_summary",
] as const;

export const aiOutcomeValues = [
  "success",
  "disabled",
  "invalid_configuration",
  "unauthorized",
  "invalid_input",
  "not_found",
  "rate_limited",
  "provider_unavailable",
  "provider_timeout",
  "provider_error",
  "provider_refusal",
  "provider_output_invalid",
] as const;

export const aiRateLimitOutcomeValues = [
  "not_checked",
  "allowed",
  "denied",
  "unavailable",
] as const;

export const aiProviderStatusValues = [
  "not_called",
  "succeeded",
  "unavailable",
  "timeout",
  "error",
  "refusal",
  "output_invalid",
] as const;

const telemetrySchema = z
  .object({
    requestId: z.uuid(),
    actorOperationalId: z
      .string()
      .regex(/^lai-ops-v1_[A-Za-z0-9_-]{43}$/)
      .optional(),
    operation: z.enum(aiOperationValues),
    model: z.enum(["gpt-5.6-terra", "gpt-5.6-luna"]).optional(),
    providerKind: z
      .enum(["openai", "deterministic-e2e", "unavailable"])
      .optional(),
    durationMs: z.number().int().nonnegative(),
    outcome: z.enum(aiOutcomeValues),
    rateLimitOutcome: z.enum(aiRateLimitOutcomeValues),
    providerStatus: z.enum(aiProviderStatusValues),
    inputCandidateCount: z.number().int().nonnegative().optional(),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
  })
  .strict();

export type AiOperationalTelemetry = z.infer<typeof telemetrySchema>;
export type AiOperationalLogLevel = "info" | "warn" | "error";

function hasMinimumUtf8Bytes(value: string | undefined): value is string {
  return Boolean(value?.trim()) && Buffer.byteLength(value!, "utf8") >= 32;
}

export function deriveAiOperationalActorId(
  authenticatedActorUuid: string,
  observabilitySecret: string,
): string {
  const actorUuid = actorUuidSchema.parse(authenticatedActorUuid);
  if (!hasMinimumUtf8Bytes(observabilitySecret)) {
    throw new TypeError("Invalid AI observability configuration");
  }
  const mac = createHmac("sha256", observabilitySecret)
    .update(`${OPERATIONAL_ACTOR_DOMAIN}${actorUuid}`, "utf8")
    .digest("base64url");
  return `${OPERATIONAL_ACTOR_PREFIX}${mac}`;
}

export function emitAiOperationalEvent(
  level: AiOperationalLogLevel,
  telemetry: AiOperationalTelemetry,
): void {
  try {
    const safeTelemetry = telemetrySchema.parse(telemetry);
    logger[level]("AI operational event", safeTelemetry);
  } catch {
    // Operational telemetry must never change an authorized application result.
  }
}
