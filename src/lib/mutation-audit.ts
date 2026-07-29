import { createHmac, randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";

export const mutationOperations = [
  "create_company",
  "update_company",
  "archive_company",
  "create_contact",
  "update_contact",
  "archive_contact",
  "create_lead",
  "update_lead",
  "archive_lead",
  "restore_lead",
  "create_lead_activity",
  "update_lead_activity",
  "archive_lead_activity",
  "restore_lead_activity",
  "convert_lead",
  "change_opportunity_stage",
  "assign_opportunity_owner",
  "set_opportunity_expected_close",
  "override_opportunity_probability",
  "clear_opportunity_probability",
  "mark_opportunity_won",
  "mark_opportunity_lost",
] as const;

export type MutationOperation = (typeof mutationOperations)[number];

export const mutationResourceTypes = [
  "company",
  "contact",
  "lead",
  "lead_activity",
  "lead_conversion",
  "opportunity",
] as const;

export type MutationResourceType = (typeof mutationResourceTypes)[number];

export const mutationOutcomes = [
  "succeeded",
  "validation",
  "unauthenticated",
  "inactive",
  "forbidden",
  "not_found",
  "confirmation_required",
  "invalid_confirmation",
  "conflict",
  "ineligible",
  "already_applied",
  "unavailable",
  "infrastructure",
  "unexpected",
] as const;

export type MutationOutcome = (typeof mutationOutcomes)[number];

export type MutationRequest = Readonly<{
  requestId: string;
  operation: MutationOperation;
  resourceType: MutationResourceType;
  issuedAt: number;
}>;

export type MutationLogContext = {
  actorId?: string;
  resourceId?: string;
  errorName?: string;
};

export function createMutationRequest(
  operation: MutationOperation,
  resourceType: MutationResourceType,
): MutationRequest {
  return {
    requestId: randomUUID(),
    operation,
    resourceType,
    issuedAt: Math.floor(Date.now() / 1000),
  };
}

export function buildMutationAuditHeaders(
  request: MutationRequest,
  secret: string | undefined,
): Record<string, string> | undefined {
  if (!secret) return undefined;
  if (secret.trim().length < 32) {
    throw new Error("Mutation audit correlation secret is invalid");
  }

  const issuedAt = String(request.issuedAt);
  const payload = `${request.requestId}:${issuedAt}:${request.operation}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  return {
    "x-laparpo-request-id": request.requestId,
    "x-laparpo-request-operation": request.operation,
    "x-laparpo-request-issued-at": issuedAt,
    "x-laparpo-request-signature": signature,
  };
}

export function logMutationOutcome(
  request: MutationRequest,
  outcome: MutationOutcome,
  context: MutationLogContext = {},
): void {
  const safeContext = {
    requestId: request.requestId,
    operation: request.operation,
    resourceType: request.resourceType,
    outcome,
    actorId: context.actorId,
    resourceId: context.resourceId,
    errorName: context.errorName,
  };

  if (outcome === "succeeded" || outcome === "already_applied") {
    logger.info("CRM mutation completed", safeContext);
    return;
  }
  if (
    outcome === "infrastructure"
    || outcome === "unexpected"
    || outcome === "unavailable"
  ) {
    logger.error("CRM mutation failed", safeContext);
    return;
  }
  logger.warn("CRM mutation rejected", safeContext);
}
