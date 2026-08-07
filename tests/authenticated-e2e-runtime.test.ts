import { describe, expect, it } from "vitest";
import {
  parseSupabaseStatusEnv,
  validateSupabaseStatus,
} from "../scripts/authenticated-e2e/runtime.mjs";

const validStatus = {
  API_URL: "http://127.0.0.1:54321",
  ANON_KEY: "local-anon-key",
  SERVICE_ROLE_KEY: "local-service-role-key",
  DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
};

describe("authenticated E2E fixture runtime", () => {
  it("parses quoted local CLI status without logging fixture secrets", () => {
    expect(
      parseSupabaseStatusEnv(
        Object.entries(validStatus)
          .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
          .join("\n"),
      ),
    ).toEqual(validStatus);
  });

  it("accepts only the dedicated local API and database ports", () => {
    expect(validateSupabaseStatus(validStatus)).toMatchObject({
      apiUrl: "http://127.0.0.1:54321",
      anonKey: "local-anon-key",
      serviceRoleKey: "local-service-role-key",
    });
    expect(() =>
      validateSupabaseStatus({
        ...validStatus,
        API_URL: "https://production-project.supabase.co",
      }),
    ).toThrow("disposable local stack");
    expect(() =>
      validateSupabaseStatus({
        ...validStatus,
        DB_URL: "postgresql://postgres:secret@db.example.com:5432/postgres",
      }),
    ).toThrow("disposable local stack");
  });

  it("fails with secret-safe configuration messages", () => {
    expect(() => validateSupabaseStatus({})).toThrow(
      "Local Supabase status is missing required fixture values",
    );
    expect(() =>
      validateSupabaseStatus({
        ...validStatus,
        SERVICE_ROLE_KEY: validStatus.ANON_KEY,
      }),
    ).toThrow("public and service-role keys must differ");
  });
});
