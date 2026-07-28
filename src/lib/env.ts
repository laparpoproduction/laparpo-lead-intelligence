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
  OPENAI_API_KEY: z.string().min(1).optional(),
  COMPANY_DUPLICATE_CONFIRMATION_SECRET: z.string().min(32).optional(),
  CONTACT_DUPLICATE_CONFIRMATION_SECRET: z.string().min(32).optional(),
  LEAD_DUPLICATE_CONFIRMATION_SECRET: z.string().min(32).optional(),
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
  | "production_demo_forbidden";

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

export const SERVICE_UNAVAILABLE_PATH = "/service-unavailable";

const productionServerEnvSchema = z.object({
  COMPANY_DUPLICATE_CONFIRMATION_SECRET: z.string().trim().min(32),
  CONTACT_DUPLICATE_CONFIRMATION_SECRET: z.string().trim().min(32),
  LEAD_DUPLICATE_CONFIRMATION_SECRET: z.string().trim().min(32),
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
}): void {
  if (input.nodeEnv !== "production") return;

  const resolution = resolveApplicationMode(input);
  if (resolution.mode !== "configured") {
    throw new ApplicationConfigurationError(resolution.issues);
  }

  productionServerEnvSchema.parse({
    COMPANY_DUPLICATE_CONFIRMATION_SECRET:
      input.companyDuplicateConfirmationSecret || undefined,
    CONTACT_DUPLICATE_CONFIRMATION_SECRET:
      input.contactDuplicateConfirmationSecret || undefined,
    LEAD_DUPLICATE_CONFIRMATION_SECRET:
      input.leadDuplicateConfirmationSecret || undefined,
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
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
    COMPANY_DUPLICATE_CONFIRMATION_SECRET:
      process.env.COMPANY_DUPLICATE_CONFIRMATION_SECRET || undefined,
    CONTACT_DUPLICATE_CONFIRMATION_SECRET:
      process.env.CONTACT_DUPLICATE_CONFIRMATION_SECRET || undefined,
    LEAD_DUPLICATE_CONFIRMATION_SECRET:
      process.env.LEAD_DUPLICATE_CONFIRMATION_SECRET || undefined,
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
  });
  return env;
}
