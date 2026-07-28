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

  it("rejects production demo mode", async () => {
    await expect(
      importNextConfig({ LAPARPO_DEMO_MODE: "true" }),
    ).rejects.toThrow("Invalid application configuration");
  });
});
