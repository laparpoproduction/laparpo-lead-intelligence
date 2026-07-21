import { describe, expect, it } from "vitest";
import { validateProductionServerEnvironment } from "./env";

describe("production server environment", () => {
  it("requires both namespaced confirmation secrets in production", () => {
    expect(() =>
      validateProductionServerEnvironment({ nodeEnv: "production" }),
    ).toThrow();
    expect(() =>
      validateProductionServerEnvironment({
        nodeEnv: "production",
        companyDuplicateConfirmationSecret: "too-short",
        contactDuplicateConfirmationSecret: "too-short",
        leadDuplicateConfirmationSecret: "too-short",
      }),
    ).toThrow();
  });

  it("accepts explicit production secrets of at least 32 characters", () => {
    expect(() =>
      validateProductionServerEnvironment({
        nodeEnv: "production",
        companyDuplicateConfirmationSecret:
          "production-company-confirmation-secret-32",
        contactDuplicateConfirmationSecret:
          "production-contact-confirmation-secret-32",
        leadDuplicateConfirmationSecret:
          "production-lead-confirmation-secret-32",
      }),
    ).not.toThrow();
  });

  it("rejects production when only one confirmation namespace is configured", () => {
    expect(() =>
      validateProductionServerEnvironment({
        nodeEnv: "production",
        companyDuplicateConfirmationSecret:
          "production-company-confirmation-secret-32",
        leadDuplicateConfirmationSecret:
          "production-lead-confirmation-secret-32",
      }),
    ).toThrow();
    expect(() =>
      validateProductionServerEnvironment({
        nodeEnv: "production",
        contactDuplicateConfirmationSecret:
          "production-contact-confirmation-secret-32",
        leadDuplicateConfirmationSecret:
          "production-lead-confirmation-secret-32",
      }),
    ).toThrow();
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
