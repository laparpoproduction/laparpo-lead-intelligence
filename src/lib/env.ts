import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
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

const productionCompanyMutationEnvSchema = z.object({
  COMPANY_DUPLICATE_CONFIRMATION_SECRET: z.string().min(32),
  CONTACT_DUPLICATE_CONFIRMATION_SECRET: z.string().min(32),
  LEAD_DUPLICATE_CONFIRMATION_SECRET: z.string().min(32),
});

export function validateProductionServerEnvironment(input: {
  nodeEnv?: string;
  companyDuplicateConfirmationSecret?: string;
  contactDuplicateConfirmationSecret?: string;
  leadDuplicateConfirmationSecret?: string;
}): void {
  if (input.nodeEnv !== "production") return;
  productionCompanyMutationEnvSchema.parse({
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
    companyDuplicateConfirmationSecret:
      process.env.COMPANY_DUPLICATE_CONFIRMATION_SECRET,
    contactDuplicateConfirmationSecret:
      process.env.CONTACT_DUPLICATE_CONFIRMATION_SECRET,
    leadDuplicateConfirmationSecret:
      process.env.LEAD_DUPLICATE_CONFIRMATION_SECRET,
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
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
    companyDuplicateConfirmationSecret:
      env.COMPANY_DUPLICATE_CONFIRMATION_SECRET,
    contactDuplicateConfirmationSecret:
      env.CONTACT_DUPLICATE_CONFIRMATION_SECRET,
    leadDuplicateConfirmationSecret:
      env.LEAD_DUPLICATE_CONFIRMATION_SECRET,
  });
  return env;
}
