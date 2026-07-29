import { describe, expect, it } from "vitest";
import {
  ApplicationConfigurationError,
  isExplicitDemoModeEnabled,
  resolveApplicationMode,
  validateProductionServerEnvironment,
  type ApplicationModeInput,
} from "./env";

const validSupabase = {
  supabaseUrl: "https://project.supabase.co",
  supabasePublishableKey: "test-publishable-key",
};

const validSecrets = {
  companyDuplicateConfirmationSecret:
    "production-company-confirmation-secret-32",
  contactDuplicateConfirmationSecret:
    "production-contact-confirmation-secret-32",
  leadDuplicateConfirmationSecret:
    "production-lead-confirmation-secret-32",
};

function productionInput(
  overrides: Partial<ApplicationModeInput> = {},
): ApplicationModeInput {
  return {
    nodeEnv: "production",
    ...validSupabase,
    demoMode: "false",
    ...overrides,
  };
}

describe("application mode", () => {
  it("uses configured mode for valid production Supabase configuration", () => {
    expect(resolveApplicationMode(productionInput())).toEqual({
      mode: "configured",
      issues: [],
    });
  });

  it("rejects a syntactically valid Supabase URL with a non-HTTP scheme", () => {
    expect(
      resolveApplicationMode(
        productionInput({ supabaseUrl: "ftp://project.supabase.co" }),
      ),
    ).toEqual({
      mode: "misconfigured",
      issues: ["invalid_supabase_url"],
    });
  });

  it.each([
    [
      "missing URL",
      productionInput({ supabaseUrl: undefined }),
      "missing_supabase_url",
    ],
    [
      "missing key",
      productionInput({ supabasePublishableKey: undefined }),
      "missing_supabase_publishable_key",
    ],
    [
      "blank key",
      productionInput({ supabasePublishableKey: "   " }),
      "missing_supabase_publishable_key",
    ],
    [
      "invalid URL",
      productionInput({ supabaseUrl: "not-a-url" }),
      "invalid_supabase_url",
    ],
    [
      "production demo",
      productionInput({ demoMode: "true" }),
      "production_demo_forbidden",
    ],
    [
      "malformed demo flag",
      productionInput({ demoMode: "yes" }),
      "invalid_demo_flag",
    ],
  ])("fails closed for production with %s", (_label, input, issue) => {
    const result = resolveApplicationMode(input);
    expect(result.mode).toBe("misconfigured");
    expect(result.issues).toContain(issue);
  });

  it("uses configured mode for valid development Supabase configuration", () => {
    expect(
      resolveApplicationMode({
        nodeEnv: "development",
        ...validSupabase,
      }),
    ).toEqual({ mode: "configured", issues: [] });
  });

  it("allows demo only with explicit non-production opt-in and no Supabase values", () => {
    expect(
      resolveApplicationMode({
        nodeEnv: "development",
        demoMode: "true",
      }),
    ).toEqual({ mode: "demo", issues: [] });
    expect(
      resolveApplicationMode({
        nodeEnv: "test",
        demoMode: "true",
      }),
    ).toEqual({ mode: "demo", issues: [] });
  });

  it("does not treat an unknown runtime environment as demo-capable", () => {
    expect(resolveApplicationMode({ demoMode: "true" }).mode).toBe(
      "misconfigured",
    );
  });

  it.each([undefined, "false"])(
    "does not infer demo from absent Supabase when the flag is %s",
    (demoMode) => {
      expect(
        resolveApplicationMode({ nodeEnv: "development", demoMode }).mode,
      ).toBe("misconfigured");
    },
  );

  it("does not allow partial or complete Supabase configuration to become demo", () => {
    expect(
      resolveApplicationMode({
        nodeEnv: "development",
        supabaseUrl: validSupabase.supabaseUrl,
        demoMode: "true",
      }),
    ).toMatchObject({
      mode: "misconfigured",
      issues: expect.arrayContaining([
        "missing_supabase_publishable_key",
        "demo_requires_absent_supabase_configuration",
      ]),
    });
    expect(
      resolveApplicationMode({
        nodeEnv: "development",
        ...validSupabase,
        demoMode: "true",
      }).mode,
    ).toBe("misconfigured");
  });

  it("does not treat defined blank Supabase variables as absent for demo", () => {
    expect(
      resolveApplicationMode({
        nodeEnv: "development",
        supabaseUrl: "",
        supabasePublishableKey: "",
        demoMode: "true",
      }),
    ).toMatchObject({
      mode: "misconfigured",
      issues: expect.arrayContaining([
        "invalid_supabase_url",
        "missing_supabase_publishable_key",
        "demo_requires_absent_supabase_configuration",
      ]),
    });
  });

  it.each(["1", "yes", "TRUE", "TRUE-with-extra-text", "", " true "])(
    "never treats arbitrary demo value %j as enabled",
    (demoMode) => {
      expect(isExplicitDemoModeEnabled(demoMode)).toBe(false);
      expect(
        resolveApplicationMode({ nodeEnv: "development", demoMode }),
      ).toMatchObject({
        mode: "misconfigured",
        issues: expect.arrayContaining(["invalid_demo_flag"]),
      });
    },
  );
});

describe("production server environment", () => {
  it("accepts valid Supabase configuration and all confirmation secrets", () => {
    expect(() =>
      validateProductionServerEnvironment({
        ...productionInput(),
        ...validSecrets,
      }),
    ).not.toThrow();
  });

  it("rejects a non-HTTP Supabase URL through production validation", () => {
    try {
      validateProductionServerEnvironment({
        ...productionInput({ supabaseUrl: "ftp://project.supabase.co" }),
        ...validSecrets,
      });
      throw new Error("Expected production validation to reject an FTP URL");
    } catch (error) {
      expect(error).toBeInstanceOf(ApplicationConfigurationError);
      expect(error).toMatchObject({
        issues: ["invalid_supabase_url"],
      });
    }
  });

  it.each([
    { supabaseUrl: undefined },
    { supabasePublishableKey: undefined },
    { supabaseUrl: "invalid" },
    { supabasePublishableKey: " " },
    { demoMode: "true" },
    { demoMode: "1" },
  ])("rejects invalid production application mode: %o", (override) => {
    expect(() =>
      validateProductionServerEnvironment({
        ...productionInput(override),
        ...validSecrets,
      }),
    ).toThrow(ApplicationConfigurationError);
  });

  it("requires every namespaced confirmation secret in production", () => {
    expect(() =>
      validateProductionServerEnvironment(productionInput()),
    ).toThrow();
    expect(() =>
      validateProductionServerEnvironment({
        ...productionInput(),
        companyDuplicateConfirmationSecret: "too-short",
        contactDuplicateConfirmationSecret: "too-short",
        leadDuplicateConfirmationSecret: "too-short",
      }),
    ).toThrow();
  });

  it("does not require production secrets outside production", () => {
    expect(() =>
      validateProductionServerEnvironment({ nodeEnv: "development" }),
    ).not.toThrow();
    expect(() =>
      validateProductionServerEnvironment({ nodeEnv: "test" }),
    ).not.toThrow();
  });
});
