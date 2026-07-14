import { describe, expect, it } from "vitest";
import {
  createContactConfirmationToken,
  verifyContactConfirmationToken,
} from "./contact-confirmation";
import { verifyCompanyConfirmationToken } from "@/lib/companies/company-confirmation";

const secret = "test-contact-confirmation-secret-32-characters";
const now = Date.UTC(2026, 6, 13, 8, 0, 0);
const actorId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const createBinding = {
  actorId,
  operation: "create" as const,
  submission: {
    fullName: "Nur Aisyah",
    workEmail: "aisyah@example.my",
  },
};

describe("contact duplicate confirmation", () => {
  it("accepts an equivalent canonical payload", () => {
    const token = createContactConfirmationToken(createBinding, { now, secret });
    expect(
      verifyContactConfirmationToken(
        token,
        {
          ...createBinding,
          submission: {
            workEmail: "aisyah@example.my",
            fullName: "Nur Aisyah",
          },
        },
        { now: now + 1_000, secret },
      ),
    ).toMatchObject({
      confirmationId: expect.any(String),
      submissionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("rejects changed payload, cross-actor, cross-operation, and wrong Contact ID", () => {
    const token = createContactConfirmationToken(createBinding, { now, secret });
    expect(
      verifyContactConfirmationToken(
        token,
        { ...createBinding, submission: { fullName: "Changed" } },
        { now, secret },
      ),
    ).toBeNull();
    expect(
      verifyContactConfirmationToken(
        token,
        { ...createBinding, actorId: contactId },
        { now, secret },
      ),
    ).toBeNull();
    expect(
      verifyContactConfirmationToken(
        token,
        { ...createBinding, operation: "update", contactId },
        { now, secret },
      ),
    ).toBeNull();

    const updateBinding = {
      actorId,
      operation: "update" as const,
      contactId,
      submission: { workEmail: "duplicate@example.my" },
    };
    const updateToken = createContactConfirmationToken(updateBinding, { now, secret });
    expect(
      verifyContactConfirmationToken(
        updateToken,
        {
          ...updateBinding,
          contactId: "33333333-3333-4333-8333-333333333333",
        },
        { now, secret },
      ),
    ).toBeNull();
  });

  it("rejects expired, future-issued, and tampered tokens", () => {
    const token = createContactConfirmationToken(createBinding, { now, secret });
    expect(
      verifyContactConfirmationToken(token, createBinding, {
        now: now + 11 * 60 * 1_000,
        secret,
      }),
    ).toBeNull();
    expect(
      verifyContactConfirmationToken(token, createBinding, {
        now: now - 1,
        secret,
      }),
    ).toBeNull();

    const [payload, signature] = token.split(".") as [string, string];
    const tampered = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
    expect(
      verifyContactConfirmationToken(`${payload}.${tampered}`, createBinding, {
        now,
        secret,
      }),
    ).toBeNull();
  });

  it("uses a contact-only token namespace without plaintext form data", () => {
    const token = createContactConfirmationToken(createBinding, { now, secret });
    expect(token).not.toContain("Nur Aisyah");
    expect(token).not.toContain("aisyah@example.my");

    const [encoded] = token.split(".");
    const payload = JSON.parse(Buffer.from(encoded ?? "", "base64url").toString("utf8"));
    expect(payload).toMatchObject({
      purpose: "contact_duplicate_confirmation",
      operation: "create",
      actorId,
    });
    expect(payload).not.toHaveProperty("submission");
    expect(
      verifyCompanyConfirmationToken(token, createBinding, { now, secret }),
    ).toBeNull();
  });
});
