import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import {
  AI_STUB_CALLS_FILE,
  AUTHENTICATED_E2E_RUNTIME_FILE,
  validateSupabaseStatus,
} from "./scripts/authenticated-e2e/runtime.mjs";

if (process.env.LAPARPO_AUTHENTICATED_E2E !== "true") {
  throw new Error("Authenticated Playwright requires explicit E2E opt-in");
}
if (process.env.LAPARPO_E2E_AI_STUB !== "true") {
  throw new Error("Authenticated Playwright requires the explicit E2E AI stub");
}
if (process.env.OPENAI_API_KEY) {
  throw new Error("Authenticated Playwright forbids a live OpenAI key");
}

const runtime = JSON.parse(
  readFileSync(AUTHENTICATED_E2E_RUNTIME_FILE, "utf8"),
) as {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  databaseUrl: string;
  serverSecrets: {
    companyConfirmation: string;
    contactConfirmation: string;
    leadConfirmation: string;
    mutationAuditCorrelation: string;
  };
};
const publicRuntime = validateSupabaseStatus({
  API_URL: runtime.apiUrl,
  ANON_KEY: runtime.anonKey,
  SERVICE_ROLE_KEY: runtime.serviceRoleKey,
  DB_URL: runtime.databaseUrl,
});

for (const value of Object.values(runtime.serverSecrets)) {
  if (typeof value !== "string" || value.length < 32) {
    throw new Error("Authenticated Playwright server secret is invalid");
  }
}

export default defineConfig({
  testDir: "./tests/e2e-authenticated",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "off",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3001",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: publicRuntime.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicRuntime.anonKey,
      LAPARPO_DEMO_MODE: "false",
      LAPARPO_AUTHENTICATED_E2E: "true",
      LAPARPO_E2E_AI_STUB: "true",
      LAPARPO_E2E_AI_STUB_CALLS_FILE: AI_STUB_CALLS_FILE,
      COMPANY_DUPLICATE_CONFIRMATION_SECRET:
        runtime.serverSecrets.companyConfirmation,
      CONTACT_DUPLICATE_CONFIRMATION_SECRET:
        runtime.serverSecrets.contactConfirmation,
      LEAD_DUPLICATE_CONFIRMATION_SECRET:
        runtime.serverSecrets.leadConfirmation,
      MUTATION_AUDIT_CORRELATION_SECRET:
        runtime.serverSecrets.mutationAuditCorrelation,
    },
    url: "http://127.0.0.1:3001/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "authenticated-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
