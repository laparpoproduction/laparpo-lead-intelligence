import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";

const confirmationPayloadSchema = z.object({
  version: z.literal(1),
  actorId: z.uuid(),
  operation: z.enum(["create", "update"]),
  companyId: z.uuid().optional(),
  submissionHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int().positive(),
});

type ConfirmationPayload = z.infer<typeof confirmationPayloadSchema>;

export type CompanyConfirmationBinding = {
  actorId: string;
  operation: "create" | "update";
  companyId?: string;
  submission: unknown;
};

const confirmationLifetimeMs = 10 * 60 * 1000;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function submissionHash(submission: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(submission)))
    .digest("hex");
}

function confirmationSecret(override?: string): string {
  const secret = override ?? getServerEnv().COMPANY_DUPLICATE_CONFIRMATION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Company duplicate confirmation secret is not configured");
  }
  return secret;
}

function signature(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

export function createCompanyConfirmationToken(
  binding: CompanyConfirmationBinding,
  options: { now?: number; secret?: string } = {},
): string {
  const payload: ConfirmationPayload = {
    version: 1,
    actorId: binding.actorId,
    operation: binding.operation,
    companyId: binding.companyId,
    submissionHash: submissionHash(binding.submission),
    expiresAt: (options.now ?? Date.now()) + confirmationLifetimeMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signed = signature(encodedPayload, confirmationSecret(options.secret));
  return `${encodedPayload}.${signed.toString("base64url")}`;
}

export function verifyCompanyConfirmationToken(
  token: string,
  binding: CompanyConfirmationBinding,
  options: { now?: number; secret?: string } = {},
): boolean {
  try {
    const [encodedPayload, encodedSignature, extra] = token.split(".");
    if (!encodedPayload || !encodedSignature || extra) return false;

    const suppliedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = signature(
      encodedPayload,
      confirmationSecret(options.secret),
    );
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      return false;
    }

    const payload = confirmationPayloadSchema.parse(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    );
    return (
      payload.expiresAt >= (options.now ?? Date.now()) &&
      payload.actorId === binding.actorId &&
      payload.operation === binding.operation &&
      payload.companyId === binding.companyId &&
      payload.submissionHash === submissionHash(binding.submission)
    );
  } catch {
    return false;
  }
}
