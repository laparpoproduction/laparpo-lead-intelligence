import { describe, expect, it } from "vitest";
import { createLeadConfirmationToken, verifyLeadConfirmationToken } from "./lead-confirmation";
import type { CreateLeadInput } from "./lead.types";

const binding = {
  actorId: "44444444-4444-4444-8444-444444444444",
  operation: "create" as const,
  submission: {
    title: "KFC Ramadan",
    sourceType: "company_website",
    discoveredAt: "2026-06-01T00:00:00.000Z",
  } satisfies CreateLeadInput,
};

describe("lead confirmation tokens", () => {
  it("creates and verifies signed confirmation tokens", () => {
    const token = createLeadConfirmationToken(binding, { secret: "lead-confirmation-secret-32-characters" });
    const verified = verifyLeadConfirmationToken(token, binding, {
      secret: "lead-confirmation-secret-32-characters",
    });

    expect(verified).toMatchObject({
      confirmationId: expect.any(String),
      submissionHash: expect.any(String),
      actorId: binding.actorId,
      operation: binding.operation,
    });
  });

  it("rejects tampered confirmations and expired tokens", () => {
    const token = createLeadConfirmationToken(binding, { secret: "lead-confirmation-secret-32-characters" });
    const tampered = `${token.slice(0, -1)}x`;
    expect(verifyLeadConfirmationToken(tampered, binding, { secret: "lead-confirmation-secret-32-characters" })).toBeNull();

    const expired = createLeadConfirmationToken(binding, {
      now: 1_000,
      secret: "lead-confirmation-secret-32-characters",
    });
    expect(
      verifyLeadConfirmationToken(expired, binding, {
        now: 1_000 + 10 * 60 * 1000 + 1,
        secret: "lead-confirmation-secret-32-characters",
      }),
    ).toBeNull();
  });

  it("rejects actor, operation, target, and normalized submission mismatches", () => {
    const secret = "lead-confirmation-secret-32-characters";
    const token = createLeadConfirmationToken(binding, { secret });
    expect(verifyLeadConfirmationToken(token, { ...binding, actorId: "55555555-5555-4555-8555-555555555555" }, { secret })).toBeNull();
    expect(verifyLeadConfirmationToken(token, {
      ...binding,
      operation: "update",
      leadId: "11111111-1111-4111-8111-111111111111",
    }, { secret })).toBeNull();
    expect(verifyLeadConfirmationToken(token, {
      ...binding,
      submission: { ...binding.submission, title: "Changed title" },
    }, { secret })).toBeNull();

    const updateBinding = {
      ...binding,
      operation: "update" as const,
      leadId: "11111111-1111-4111-8111-111111111111",
    };
    const updateToken = createLeadConfirmationToken(updateBinding, { secret });
    expect(verifyLeadConfirmationToken(updateToken, {
      ...updateBinding,
      leadId: "22222222-2222-4222-8222-222222222222",
    }, { secret })).toBeNull();
  });
});
