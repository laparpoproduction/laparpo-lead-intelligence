import { afterEach, describe, expect, it, vi } from "vitest";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ci-test.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ci-test-publishable-key",
  LAPARPO_DEMO_MODE: "false",
  COMPANY_DUPLICATE_CONFIRMATION_SECRET:
    "ci-company-confirmation-secret-value",
  CONTACT_DUPLICATE_CONFIRMATION_SECRET:
    "ci-contact-confirmation-secret-value",
  LEAD_DUPLICATE_CONFIRMATION_SECRET:
    "ci-lead-confirmation-secret-value",
  MUTATION_AUDIT_CORRELATION_SECRET:
    "ci-mutation-audit-correlation-secret-value",
  LAPARPO_AUTHENTICATED_E2E: "false",
  LAPARPO_E2E_AI_STUB: "false",
  LAPARPO_E2E_AI_STUB_CALLS_FILE: undefined,
  AI_FEATURES_ENABLED: "false",
  AI_IDENTITY_HMAC_SECRET: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
};

async function importNextConfig(
  overrides: Partial<Record<keyof typeof validEnvironment, string | undefined>>,
) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  for (const [name, value] of Object.entries({
    ...validEnvironment,
    ...overrides,
  })) {
    vi.stubEnv(name, value);
  }
  return import("../../next.config");
}

describe("next.config production validation integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("loads with valid non-secret test Supabase configuration", async () => {
    await expect(importNextConfig({})).resolves.toHaveProperty("default");
  });

  it("rejects a config invocation missing the Supabase URL", async () => {
    await expect(
      importNextConfig({ NEXT_PUBLIC_SUPABASE_URL: undefined }),
    ).rejects.toThrow("Invalid application configuration");
  });

  it("rejects a config invocation missing the publishable key", async () => {
    await expect(
      importNextConfig({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
      }),
    ).rejects.toThrow("Invalid application configuration");
  });

  it("rejects a config invocation with a non-HTTP Supabase URL", async () => {
    await expect(
      importNextConfig({
        NEXT_PUBLIC_SUPABASE_URL: "ftp://project.supabase.co",
      }),
    ).rejects.toThrow(
      "Invalid application configuration: invalid_supabase_url",
    );
  });

  it("rejects production demo mode", async () => {
    await expect(
      importNextConfig({ LAPARPO_DEMO_MODE: "true" }),
    ).rejects.toThrow("Invalid application configuration");
  });

  it("rejects production authenticated E2E flags", async () => {
    await expect(
      importNextConfig({
        LAPARPO_AUTHENTICATED_E2E: "true",
        LAPARPO_E2E_AI_STUB: "true",
        LAPARPO_E2E_AI_STUB_CALLS_FILE: "/tmp/calls",
      }),
    ).rejects.toThrow("production_authenticated_e2e_forbidden");
  });

  it("rejects production without mutation audit correlation", async () => {
    await expect(
      importNextConfig({
        MUTATION_AUDIT_CORRELATION_SECRET: undefined,
      }),
    ).rejects.toThrow();
  });

  it("fails closed for malformed or incomplete enabled AI configuration", async () => {
    await expect(importNextConfig({ AI_FEATURES_ENABLED: "TRUE" })).rejects.toThrow(
      "invalid_ai_features_enabled",
    );
    await expect(importNextConfig({ AI_FEATURES_ENABLED: "true" })).rejects.toThrow(
      "enabled_ai_requires_openai_key",
    );
    await expect(
      importNextConfig({
        AI_FEATURES_ENABLED: "true",
        OPENAI_API_KEY: "unit-test-key",
        AI_IDENTITY_HMAC_SECRET: "short",
      }),
    ).rejects.toThrow("enabled_ai_requires_identity_secret");
    await expect(
      importNextConfig({
        AI_FEATURES_ENABLED: "true",
        OPENAI_API_KEY: "unit-test-key",
        AI_IDENTITY_HMAC_SECRET: "identity-secret-that-is-at-least-32-bytes",
        OPENAI_MODEL: "unapproved-model",
      }),
    ).rejects.toThrow("invalid_openai_model");
  });

  it("accepts production disabled without AI credentials and enabled with strict configuration", async () => {
    await expect(importNextConfig({ AI_FEATURES_ENABLED: "false" })).resolves.toHaveProperty("default");
    await expect(
      importNextConfig({
        AI_FEATURES_ENABLED: "true",
        OPENAI_API_KEY: "unit-test-key",
        AI_IDENTITY_HMAC_SECRET: "identity-secret-that-is-at-least-32-bytes",
        OPENAI_MODEL: "gpt-5.6-terra",
      }),
    ).resolves.toHaveProperty("default");
  });
});
