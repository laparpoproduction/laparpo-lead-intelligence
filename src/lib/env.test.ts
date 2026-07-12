import { describe, expect, it } from "vitest";
import { validateProductionServerEnvironment } from "./env";

describe("production server environment", () => {
  it("requires the company confirmation secret in production", () => {
    expect(() =>
      validateProductionServerEnvironment({ nodeEnv: "production" }),
    ).toThrow();
    expect(() =>
      validateProductionServerEnvironment({
        nodeEnv: "production",
        companyDuplicateConfirmationSecret: "too-short",
      }),
    ).toThrow();
  });

  it("accepts an explicit production secret of at least 32 characters", () => {
    expect(() =>
      validateProductionServerEnvironment({
        nodeEnv: "production",
        companyDuplicateConfirmationSecret:
          "production-company-confirmation-secret-32",
      }),
    ).not.toThrow();
  });

  it("allows missing secrets outside production for explicit local and test workflows", () => {
    expect(() =>
      validateProductionServerEnvironment({ nodeEnv: "development" }),
    ).not.toThrow();
    expect(() =>
      validateProductionServerEnvironment({ nodeEnv: "test" }),
    ).not.toThrow();
  });
});
