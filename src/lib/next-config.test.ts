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
});
