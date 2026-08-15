import { z } from "zod";

const supabaseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//.test(value), {
    message: "Supabase URL must use HTTP or HTTPS",
  });

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrlSchema,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
});

const serverEnvSchema = z.object({
  AI_FEATURES_ENABLED: z.enum(["true", "false"]).optional(),
  AI_IDENTITY_HMAC_SECRET: z.string().optional(),
  AI_OBSERVABILITY_HMAC_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).optional(),
  COMPANY_DUPLICATE_CONFIRMATION_SECRET: z.string().min(32).optional(),
  CONTACT_DUPLICATE_CONFIRMATION_SECRET: z.string().min(32).optional(),
  LEAD_DUPLICATE_CONFIRMATION_SECRET: z.string().min(32).optional(),
  MUTATION_AUDIT_CORRELATION_SECRET: z.string().min(32).optional(),
  LAPARPO_AUTHENTICATED_E2E: z.enum(["true", "false"]).optional(),
  LAPARPO_E2E_AI_STUB: z.enum(["true", "false"]).optional(),
  LAPARPO_E2E_AI_STUB_CALLS_FILE: z.string().trim().min(1).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const applicationModeValues = [
  "configured",
  "demo",
  "misconfigured",
] as const;

export type ApplicationMode = (typeof applicationModeValues)[number];

export type ApplicationConfigurationIssue =
  | "demo_requires_absent_supabase_configuration"
  | "invalid_demo_flag"
  | "invalid_supabase_url"
  | "missing_supabase_configuration"
  | "missing_supabase_publishable_key"
  | "missing_supabase_url"
  | "production_demo_forbidden"
  | "invalid_authenticated_e2e_flag"
  | "invalid_e2e_ai_stub_flag"
  | "authenticated_e2e_requires_ai_stub"
  | "e2e_ai_stub_requires_authenticated_e2e"
  | "authenticated_e2e_requires_configured_mode"
  | "authenticated_e2e_requires_nonproduction"
  | "authenticated_e2e_requires_calls_file"
  | "production_authenticated_e2e_forbidden"
  | "production_e2e_ai_stub_forbidden"
  | "invalid_ai_features_enabled"
  | "enabled_ai_requires_openai_key"
  | "enabled_ai_requires_identity_secret"
  | "enabled_ai_requires_observability_secret"
  | "invalid_openai_model";

export type ApplicationModeInput = {
  nodeEnv?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  demoMode?: string;
};

export type ApplicationModeResolution = {
  mode: ApplicationMode;
  issues: readonly ApplicationConfigurationIssue[];
};

export type AuthenticatedE2EEnvironmentInput = {
  nodeEnv?: string;
  applicationMode: ApplicationMode;
  authenticatedE2E?: string;
  aiStub?: string;
  aiStubCallsFile?: string;
};

export type AuthenticatedE2EEnvironmentResolution = {
  enabled: boolean;
  issues: readonly ApplicationConfigurationIssue[];
};

export const SERVICE_UNAVAILABLE_PATH = "/service-unavailable";

const productionServerEnvSchema = z.object({
  COMPANY_DUPLICATE_CONFIRMATION_SECRET: z.string().trim().min(32),
  CONTACT_DUPLICATE_CONFIRMATION_SECRET: z.string().trim().min(32),
  LEAD_DUPLICATE_CONFIRMATION_SECRET: z.string().trim().min(32),
  MUTATION_AUDIT_CORRELATION_SECRET: z.string().trim().min(32),
});

export class ApplicationConfigurationError extends Error {
  constructor(readonly issues: readonly ApplicationConfigurationIssue[]) {
    super(`Invalid application configuration: ${issues.join(",")}`);
    this.name = "ApplicationConfigurationError";
  }
}

export function isExplicitDemoModeEnabled(value: string | undefined): boolean {
  return value === "true";
}

export function isExactBooleanFlag(value: string | undefined): boolean {
  return value === undefined || value === "true" || value === "false";
}

export function resolveAuthenticatedE2EEnvironment(
  input: AuthenticatedE2EEnvironmentInput,
): AuthenticatedE2EEnvironmentResolution {
  const issues: ApplicationConfigurationIssue[] = [];
  const authenticatedEnabled = input.authenticatedE2E === "true";
  const aiStubEnabled = input.aiStub === "true";
  const isKnownNonProduction =
    input.nodeEnv === "development" || input.nodeEnv === "test";

  if (!isExactBooleanFlag(input.authenticatedE2E)) {
    issues.push("invalid_authenticated_e2e_flag");
  }
  if (!isExactBooleanFlag(input.aiStub)) {
    issues.push("invalid_e2e_ai_stub_flag");
  }
  if (input.nodeEnv === "production" && authenticatedEnabled) {
    issues.push("production_authenticated_e2e_forbidden");
  }
  if (input.nodeEnv === "production" && aiStubEnabled) {
    issues.push("production_e2e_ai_stub_forbidden");
  }
  if (authenticatedEnabled && !aiStubEnabled) {
    issues.push("authenticated_e2e_requires_ai_stub");
  }
  if (aiStubEnabled && !authenticatedEnabled) {
    issues.push("e2e_ai_stub_requires_authenticated_e2e");
  }
  if (
    (authenticatedEnabled || aiStubEnabled) &&
    input.applicationMode !== "configured"
  ) {
    issues.push("authenticated_e2e_requires_configured_mode");
  }
  if ((authenticatedEnabled || aiStubEnabled) && !isKnownNonProduction) {
    issues.push("authenticated_e2e_requires_nonproduction");
  }
  if (
    (authenticatedEnabled || aiStubEnabled) &&
    !input.aiStubCallsFile?.trim()
  ) {
    issues.push("authenticated_e2e_requires_calls_file");
  }

  return {
    enabled:
      issues.length === 0 && authenticatedEnabled && aiStubEnabled,
    issues,
  };
}

export function resolveApplicationMode(
  input: ApplicationModeInput,
): ApplicationModeResolution {
  const issues: ApplicationConfigurationIssue[] = [];
  const supabaseUrl = input.supabaseUrl?.trim();
  const supabasePublishableKey = input.supabasePublishableKey?.trim();
  const hasUrlVariable = input.supabaseUrl !== undefined;
  const hasKeyVariable = input.supabasePublishableKey !== undefined;
  const demoFlagIsValid =
    input.demoMode === undefined ||
    input.demoMode === "false" ||
    input.demoMode === "true";
  const demoEnabled = isExplicitDemoModeEnabled(input.demoMode);
  const isKnownNonProduction =
    input.nodeEnv === "development" || input.nodeEnv === "test";

  if (!demoFlagIsValid) issues.push("invalid_demo_flag");

  if (
    hasUrlVariable &&
    (!supabaseUrl || !supabaseUrlSchema.safeParse(supabaseUrl).success)
  ) {
    issues.push("invalid_supabase_url");
  }

  if (hasUrlVariable && !supabasePublishableKey) {
    issues.push("missing_supabase_publishable_key");
  } else if (hasKeyVariable && !supabaseUrl) {
    issues.push("missing_supabase_url");
  }

  if (demoEnabled && input.nodeEnv === "production") {
    issues.push("production_demo_forbidden");
  }

  if (demoEnabled && (hasUrlVariable || hasKeyVariable)) {
    issues.push("demo_requires_absent_supabase_configuration");
  }

  if (
    issues.length === 0 &&
    supabaseUrl &&
    supabasePublishableKey &&
    !demoEnabled
  ) {
    return { mode: "configured", issues: [] };
  }

  if (
    issues.length === 0 &&
    !hasUrlVariable &&
    !hasKeyVariable &&
    demoEnabled &&
    isKnownNonProduction
  ) {
    return { mode: "demo", issues: [] };
  }

  if (issues.length === 0) issues.push("missing_supabase_configuration");
  return { mode: "misconfigured", issues };
}

export function getApplicationModeResolution(): ApplicationModeResolution {
  return resolveApplicationMode({
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    demoMode: process.env.LAPARPO_DEMO_MODE,
  });
}

export function getApplicationMode(): ApplicationMode {
  return getApplicationModeResolution().mode;
}

export function validateProductionServerEnvironment(input: {
  nodeEnv?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  demoMode?: string;
  companyDuplicateConfirmationSecret?: string;
  contactDuplicateConfirmationSecret?: string;
  leadDuplicateConfirmationSecret?: string;
  mutationAuditCorrelationSecret?: string;
  authenticatedE2E?: string;
  aiStub?: string;
  aiStubCallsFile?: string;
  aiFeaturesEnabled?: string;
  aiIdentityHmacSecret?: string;
  aiObservabilityHmacSecret?: string;
  openAiApiKey?: string;
  openAiModel?: string;
}): void {
  if (input.nodeEnv !== "production") return;

  const resolution = resolveApplicationMode(input);
  if (resolution.mode !== "configured") {
    throw new ApplicationConfigurationError(resolution.issues);
  }

  const authenticatedE2EResolution = resolveAuthenticatedE2EEnvironment({
    nodeEnv: input.nodeEnv,
    applicationMode: resolution.mode,
    authenticatedE2E: input.authenticatedE2E,
    aiStub: input.aiStub,
    aiStubCallsFile: input.aiStubCallsFile,
  });
  if (authenticatedE2EResolution.issues.length > 0) {
    throw new ApplicationConfigurationError(
      authenticatedE2EResolution.issues,
    );
  }

  if (!isExactBooleanFlag(input.aiFeaturesEnabled)) {
    throw new ApplicationConfigurationError(["invalid_ai_features_enabled"]);
  }
  if (input.aiFeaturesEnabled === "true") {
    const issues: ApplicationConfigurationIssue[] = [];
    if (!input.openAiApiKey?.trim() && input.aiStub !== "true") {
      issues.push("enabled_ai_requires_openai_key");
    }
    if (
      !input.aiIdentityHmacSecret?.trim() ||
      Buffer.byteLength(input.aiIdentityHmacSecret, "utf8") < 32
    ) {
      issues.push("enabled_ai_requires_identity_secret");
    }
    if (
      !input.aiObservabilityHmacSecret?.trim() ||
      Buffer.byteLength(input.aiObservabilityHmacSecret, "utf8") < 32
    ) {
      issues.push("enabled_ai_requires_observability_secret");
    }
    if (
      input.openAiModel !== undefined &&
      input.openAiModel !== "gpt-5.6-terra" &&
      input.openAiModel !== "gpt-5.6-luna"
    ) {
      issues.push("invalid_openai_model");
    }
    if (issues.length > 0) throw new ApplicationConfigurationError(issues);
  }

  productionServerEnvSchema.parse({
    COMPANY_DUPLICATE_CONFIRMATION_SECRET:
      input.companyDuplicateConfirmationSecret || undefined,
    CONTACT_DUPLICATE_CONFIRMATION_SECRET:
      input.contactDuplicateConfirmationSecret || undefined,
    LEAD_DUPLICATE_CONFIRMATION_SECRET:
      input.leadDuplicateConfirmationSecret || undefined,
    MUTATION_AUDIT_CORRELATION_SECRET:
      input.mutationAuditCorrelationSecret || undefined,
  });
}

export function assertProductionServerEnvironment(): void {
  validateProductionServerEnvironment({
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    demoMode: process.env.LAPARPO_DEMO_MODE,
    companyDuplicateConfirmationSecret:
      process.env.COMPANY_DUPLICATE_CONFIRMATION_SECRET,
    contactDuplicateConfirmationSecret:
      process.env.CONTACT_DUPLICATE_CONFIRMATION_SECRET,
    leadDuplicateConfirmationSecret:
      process.env.LEAD_DUPLICATE_CONFIRMATION_SECRET,
    mutationAuditCorrelationSecret:
      process.env.MUTATION_AUDIT_CORRELATION_SECRET,
    authenticatedE2E: process.env.LAPARPO_AUTHENTICATED_E2E,
    aiStub: process.env.LAPARPO_E2E_AI_STUB,
    aiStubCallsFile: process.env.LAPARPO_E2E_AI_STUB_CALLS_FILE,
    aiFeaturesEnabled: process.env.AI_FEATURES_ENABLED,
    aiIdentityHmacSecret: process.env.AI_IDENTITY_HMAC_SECRET,
    aiObservabilityHmacSecret: process.env.AI_OBSERVABILITY_HMAC_SECRET,
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiModel: process.env.OPENAI_MODEL,
  });
}

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getServerEnv(): ServerEnv {
  const env = serverEnvSchema.parse({
    AI_FEATURES_ENABLED: process.env.AI_FEATURES_ENABLED || undefined,
    AI_IDENTITY_HMAC_SECRET:
      process.env.AI_IDENTITY_HMAC_SECRET || undefined,
    AI_OBSERVABILITY_HMAC_SECRET:
      process.env.AI_OBSERVABILITY_HMAC_SECRET || undefined,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY?.trim() || undefined,
    OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || undefined,
    COMPANY_DUPLICATE_CONFIRMATION_SECRET:
      process.env.COMPANY_DUPLICATE_CONFIRMATION_SECRET || undefined,
    CONTACT_DUPLICATE_CONFIRMATION_SECRET:
      process.env.CONTACT_DUPLICATE_CONFIRMATION_SECRET || undefined,
    LEAD_DUPLICATE_CONFIRMATION_SECRET:
      process.env.LEAD_DUPLICATE_CONFIRMATION_SECRET || undefined,
    MUTATION_AUDIT_CORRELATION_SECRET:
      process.env.MUTATION_AUDIT_CORRELATION_SECRET || undefined,
    LAPARPO_AUTHENTICATED_E2E:
      process.env.LAPARPO_AUTHENTICATED_E2E || undefined,
    LAPARPO_E2E_AI_STUB: process.env.LAPARPO_E2E_AI_STUB || undefined,
    LAPARPO_E2E_AI_STUB_CALLS_FILE:
      process.env.LAPARPO_E2E_AI_STUB_CALLS_FILE || undefined,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });
  validateProductionServerEnvironment({
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    demoMode: process.env.LAPARPO_DEMO_MODE,
    companyDuplicateConfirmationSecret:
      env.COMPANY_DUPLICATE_CONFIRMATION_SECRET,
    contactDuplicateConfirmationSecret:
      env.CONTACT_DUPLICATE_CONFIRMATION_SECRET,
    leadDuplicateConfirmationSecret:
      env.LEAD_DUPLICATE_CONFIRMATION_SECRET,
    mutationAuditCorrelationSecret:
      env.MUTATION_AUDIT_CORRELATION_SECRET,
    authenticatedE2E: env.LAPARPO_AUTHENTICATED_E2E,
    aiStub: env.LAPARPO_E2E_AI_STUB,
    aiStubCallsFile: env.LAPARPO_E2E_AI_STUB_CALLS_FILE,
    aiFeaturesEnabled: env.AI_FEATURES_ENABLED,
    aiIdentityHmacSecret: env.AI_IDENTITY_HMAC_SECRET,
    aiObservabilityHmacSecret: env.AI_OBSERVABILITY_HMAC_SECRET,
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL,
  });
  return env;
}
