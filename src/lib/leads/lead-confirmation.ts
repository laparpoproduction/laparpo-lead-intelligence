import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import type { CreateLeadInput, UpdateLeadInput } from "./lead.types";

export type LeadConfirmationOperation = "create" | "update";

export type LeadConfirmationBinding = {
  actorId: string;
  operation: LeadConfirmationOperation;
  leadId?: string;
  submission: CreateLeadInput | UpdateLeadInput;
};

export type LeadConfirmationContext = {
  confirmationId: string;
  submissionHash: string;
  actorId: string;
  operation: LeadConfirmationOperation;
  leadId?: string;
};

const confirmationPayloadSchema = z.object({
  purpose: z.literal("lead_duplicate_confirmation"),
  version: z.literal(1),
  confirmationId: z.uuid(),
  actorId: z.uuid(),
  operation: z.enum(["create", "update"]),
  leadId: z.uuid().optional(),
  submissionHash: z.string().regex(/^[a-f0-9]{64}$/),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
});

type ConfirmationPayload = z.infer<typeof confirmationPayloadSchema>;

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

function hashSubmission(submission: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(submission)))
    .digest("hex");
}

function confirmationSecret(override?: string): string {
  const secret = override ?? getServerEnv().LEAD_DUPLICATE_CONFIRMATION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Lead duplicate confirmation secret is not configured");
  }
  return secret;
}

function sign(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update(`lead-duplicate-confirmation:v1:${encodedPayload}`)
    .digest();
}

export function createLeadConfirmationToken(
  binding: LeadConfirmationBinding,
  options: { now?: number; secret?: string; confirmationId?: string } = {},
): string {
  const now = options.now ?? Date.now();
  const payload: ConfirmationPayload = {
    purpose: "lead_duplicate_confirmation",
    version: 1,
    confirmationId: options.confirmationId ?? randomUUID(),
    actorId: binding.actorId,
    operation: binding.operation,
    leadId: binding.leadId,
    submissionHash: hashSubmission(binding.submission),
    issuedAt: now,
    expiresAt: now + confirmationLifetimeMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, confirmationSecret(options.secret)).toString("base64url")}`;
}

export function verifyLeadConfirmationToken(
  token: string,
  binding: LeadConfirmationBinding,
  options: { now?: number; secret?: string } = {},
): LeadConfirmationContext | null {
  try {
    const [encodedPayload, encodedSignature, extra] = token.split(".");
    if (!encodedPayload || !encodedSignature || extra) return null;

    const suppliedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = sign(encodedPayload, confirmationSecret(options.secret));
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      return null;
    }

    const payload = confirmationPayloadSchema.parse(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    );
    const now = options.now ?? Date.now();
    const valid =
      payload.issuedAt <= now &&
      payload.expiresAt >= now &&
      payload.actorId === binding.actorId &&
      payload.operation === binding.operation &&
      payload.leadId === binding.leadId &&
      payload.submissionHash === hashSubmission(binding.submission);

    return valid
      ? {
          confirmationId: payload.confirmationId,
          submissionHash: payload.submissionHash,
          actorId: payload.actorId,
          operation: payload.operation,
          leadId: payload.leadId,
        }
      : null;
  } catch {
    return null;
  }
}
