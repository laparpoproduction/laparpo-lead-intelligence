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
});
