import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";
import {
  getApplicationMode,
  resolveAuthenticatedE2EEnvironment,
} from "@/lib/env";
import {
  companyIntelligenceModelValues,
  type CompanyIntelligenceModel,
} from "./company-intelligence.types";

export const DEFAULT_AI_MODEL: CompanyIntelligenceModel = "gpt-5.6-terra";
const SAFETY_IDENTIFIER_DOMAIN = "openai-safety:v1:";
const SAFETY_IDENTIFIER_PREFIX = "lai-ai-v1_";
const actorUuidSchema = z.string().uuid();

export type AiProviderKind = "openai" | "deterministic-e2e";

export type AiControlConfiguration =
  | { status: "disabled" }
  | { status: "invalid" }
  | {
      status: "enabled";
      providerKind: AiProviderKind;
      model: CompanyIntelligenceModel;
      identitySecret: string;
      observabilitySecret: string;
      openAiApiKey?: string;
      deterministicCallsFile?: string;
    };

export type AiControlInput = {
  nodeEnv?: string;
  applicationMode: ReturnType<typeof getApplicationMode>;
  enabled?: string;
  identitySecret?: string;
  observabilitySecret?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  authenticatedE2E?: string;
  aiStub?: string;
  aiStubCallsFile?: string;
};

function hasMinimumUtf8Bytes(value: string | undefined): value is string {
  return Boolean(value?.trim()) && Buffer.byteLength(value!, "utf8") >= 32;
}

export function resolveAiControlConfiguration(
  input: AiControlInput,
): AiControlConfiguration {
  if (input.enabled === undefined || input.enabled === "false") {
    return { status: "disabled" };
  }
  if (input.enabled !== "true" || input.applicationMode !== "configured") {
    return { status: "invalid" };
  }
  if (!hasMinimumUtf8Bytes(input.identitySecret)) {
    return { status: "invalid" };
  }
  if (!hasMinimumUtf8Bytes(input.observabilitySecret)) {
    return { status: "invalid" };
  }

  const e2e = resolveAuthenticatedE2EEnvironment({
    nodeEnv: input.nodeEnv,
    applicationMode: input.applicationMode,
    authenticatedE2E: input.authenticatedE2E,
    aiStub: input.aiStub,
    aiStubCallsFile: input.aiStubCallsFile,
  });
  if (e2e.issues.length > 0) return { status: "invalid" };

  if (e2e.enabled) {
    if (input.nodeEnv === "production") return { status: "invalid" };
    return {
      status: "enabled",
      providerKind: "deterministic-e2e",
      model: DEFAULT_AI_MODEL,
      identitySecret: input.identitySecret,
      observabilitySecret: input.observabilitySecret,
      deterministicCallsFile: input.aiStubCallsFile,
    };
  }

  const model = input.openAiModel ?? DEFAULT_AI_MODEL;
  if (
    !companyIntelligenceModelValues.includes(
      model as CompanyIntelligenceModel,
    ) ||
    !input.openAiApiKey?.trim()
  ) {
    return { status: "invalid" };
  }
  return {
    status: "enabled",
    providerKind: "openai",
    model: model as CompanyIntelligenceModel,
    identitySecret: input.identitySecret,
    observabilitySecret: input.observabilitySecret,
    openAiApiKey: input.openAiApiKey,
  };
}

export function getAiControlConfiguration(): AiControlConfiguration {
  return resolveAiControlConfiguration({
    nodeEnv: process.env.NODE_ENV,
    applicationMode: getApplicationMode(),
    enabled: process.env.AI_FEATURES_ENABLED,
    identitySecret: process.env.AI_IDENTITY_HMAC_SECRET,
    observabilitySecret: process.env.AI_OBSERVABILITY_HMAC_SECRET,
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiModel: process.env.OPENAI_MODEL,
    authenticatedE2E: process.env.LAPARPO_AUTHENTICATED_E2E,
    aiStub: process.env.LAPARPO_E2E_AI_STUB,
    aiStubCallsFile: process.env.LAPARPO_E2E_AI_STUB_CALLS_FILE,
  });
}

export function deriveOpenAiSafetyIdentifier(
  authenticatedActorUuid: string,
  identitySecret: string,
): string {
  const actorUuid = actorUuidSchema.parse(authenticatedActorUuid);
  if (!hasMinimumUtf8Bytes(identitySecret)) {
    throw new TypeError("Invalid AI identity configuration");
  }
  const mac = createHmac("sha256", identitySecret)
    .update(`${SAFETY_IDENTIFIER_DOMAIN}${actorUuid}`, "utf8")
    .digest("base64url");
  return `${SAFETY_IDENTIFIER_PREFIX}${mac}`;
}
