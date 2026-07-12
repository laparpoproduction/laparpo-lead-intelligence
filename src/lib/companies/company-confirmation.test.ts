import { describe, expect, it } from "vitest";
import {
  createCompanyConfirmationToken,
  verifyCompanyConfirmationToken,
} from "./company-confirmation";

const secret = "test-company-confirmation-secret-32-characters";
const now = Date.UTC(2026, 6, 12, 8, 0, 0);
const binding = {
  actorId: "11111111-1111-4111-8111-111111111111",
  operation: "create" as const,
  submission: {
    displayName: "ABC (Malaysia)",
    websiteUrl: "https://example.my",
  },
};

describe("company duplicate confirmation", () => {
  it("accepts the same canonical submission and actor", () => {
    const token = createCompanyConfirmationToken(binding, { now, secret });
    expect(
      verifyCompanyConfirmationToken(
        token,
        {
          ...binding,
          submission: {
            websiteUrl: "https://example.my",
            displayName: "ABC (Malaysia)",
          },
        },
        { now: now + 1_000, secret },
      ),
    ).toMatchObject({
      confirmationId: expect.any(String),
      submissionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("rejects changed payloads, actors, operations, and expired tokens", () => {
    const token = createCompanyConfirmationToken(binding, { now, secret });
    expect(
      verifyCompanyConfirmationToken(
        token,
        { ...binding, submission: { displayName: "Changed" } },
        { now, secret },
      ),
    ).toBeNull();
    expect(
      verifyCompanyConfirmationToken(
        token,
        { ...binding, actorId: "22222222-2222-4222-8222-222222222222" },
        { now, secret },
      ),
    ).toBeNull();
    expect(
      verifyCompanyConfirmationToken(
        token,
        {
          ...binding,
          operation: "update",
          companyId: "33333333-3333-4333-8333-333333333333",
        },
        { now, secret },
      ),
    ).toBeNull();
    expect(
      verifyCompanyConfirmationToken(token, binding, {
        now: now + 11 * 60 * 1_000,
        secret,
      }),
    ).toBeNull();
  });

  it("rejects tampered signatures", () => {
    const token = createCompanyConfirmationToken(binding, { now, secret });
    const [payload, signed] = token.split(".") as [string, string];
    const tamperedSignature = `${signed.startsWith("A") ? "B" : "A"}${signed.slice(1)}`;
    expect(
      verifyCompanyConfirmationToken(`${payload}.${tamperedSignature}`, binding, {
        now,
        secret,
      }),
    ).toBeNull();
  });
});
