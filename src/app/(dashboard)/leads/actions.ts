"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { LeadFormState } from "./form-state";
import {
  createLeadConfirmationToken,
  verifyLeadConfirmationToken,
  type LeadConfirmationBinding,
} from "@/lib/leads/lead-confirmation";
import { parseCreateLeadForm, parseDeleteLeadForm, parseUpdateLeadForm } from "@/lib/leads/lead-form";
import { LeadRepositoryNotFoundError } from "@/lib/leads/lead.repository";
import { LeadDuplicateError, LeadNotFoundError, LeadPermissionError, LeadValidationError } from "@/lib/leads/lead.service";
import { LeadMutationAuthError, createLeadMutationContext, type LeadMutationContext } from "@/lib/leads/lead.server";
import { logger } from "@/lib/logger";

const duplicateCandidateLimit = 20;

function issuesState(issues: z.ZodIssue[]): LeadFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }
  return {
    status: "validation_error",
    message: "Check the highlighted lead fields.",
    fieldErrors,
  };
}

function authErrorState(error: LeadMutationAuthError): LeadFormState {
  if (error.code === "inactive") {
    return {
      status: "permission_error",
      message: "Your account is inactive and cannot change leads.",
    };
  }
  if (error.code === "unauthenticated") {
    return {
      status: "permission_error",
      message: "Sign in before changing lead records.",
    };
  }
  return {
    status: "error",
    message: "Lead mutations are temporarily unavailable.",
  };
}

async function mutationContext(): Promise<{ context: LeadMutationContext } | { state: LeadFormState }> {
  try {
    return { context: await createLeadMutationContext() };
  } catch (error) {
    if (error instanceof LeadMutationAuthError) return { state: authErrorState(error) };
    logger.error("Lead mutation context failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      state: {
        status: "error",
        message: "Lead mutations are temporarily unavailable.",
      },
    };
  }
}

function knownErrorState(error: unknown): LeadFormState | null {
  if (error instanceof z.ZodError) return issuesState(error.issues);
  if (error instanceof LeadValidationError) return issuesState(error.issues);
  if (error instanceof LeadPermissionError) {
    return { status: "permission_error", message: "You cannot change this lead." };
  }
  if (error instanceof LeadNotFoundError || error instanceof LeadRepositoryNotFoundError) {
    return { status: "not_found", message: "The lead could not be found." };
  }
  return null;
}

function invalidConfirmationState(): LeadFormState {
  return {
    status: "validation_error",
    message: "The duplicate confirmation is invalid, expired, or belongs to a changed form.",
    fieldErrors: {
      confirmationToken: ["Submit the form again to review current duplicate matches."],
    },
  };
}

function duplicateWarningState(error: LeadDuplicateError, binding: LeadConfirmationBinding): LeadFormState {
  try {
    return {
      status: "duplicate_warning",
      message: "A likely duplicate lead exists. Review the warning before continuing.",
      duplicateCandidateIds: error.candidateIds.slice(0, duplicateCandidateLimit),
      confirmationToken: createLeadConfirmationToken(binding),
    };
  } catch (tokenError) {
    return unexpectedErrorState(binding.operation, tokenError, binding.actorId);
  }
}

function unexpectedErrorState(operation: "create" | "update" | "soft_delete", error: unknown, actorId?: string): LeadFormState {
  logger.error("Lead mutation failed", {
    operation,
    actorId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return {
    status: "error",
    message: "The lead could not be saved. Try again or contact an administrator.",
  };
}

export async function createLeadAction(_state: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseCreateLeadForm(formData);
    const binding: LeadConfirmationBinding = {
      actorId: actor.userId,
      operation: "create",
      submission: parsed.input,
    };
    let leadId: string;
    if (parsed.confirmationToken) {
      const verified = verifyLeadConfirmationToken(parsed.confirmationToken, binding);
      if (!verified) return invalidConfirmationState();
      const result = await service.createConfirmedDuplicate?.(parsed.input, actor, {
        ...verified,
        operation: "create",
      });
      if (!result) return unexpectedErrorState("create", new Error("confirmation flow unavailable"), actor.userId);
      leadId = result.leadId;
    } else {
      leadId = (await service.create(parsed.input, actor)).id;
    }
    revalidatePath("/leads");
    return {
      status: "success",
      message: "Lead created successfully.",
      leadId,
      redirectTo: `/leads/${leadId}`,
    };
  } catch (error) {
    if (error instanceof LeadDuplicateError) {
      const parsed = parseCreateLeadForm(formData);
      return duplicateWarningState(error, {
        actorId: actor.userId,
        operation: "create",
        submission: parsed.input,
      });
    }
    return knownErrorState(error) ?? unexpectedErrorState("create", error, actor.userId);
  }
}

export async function updateLeadAction(_state: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseUpdateLeadForm(formData);
    const binding: LeadConfirmationBinding = {
      actorId: actor.userId,
      operation: "update",
      leadId: parsed.leadId,
      submission: parsed.input,
    };
    let leadId: string;
    if (parsed.confirmationToken) {
      const verified = verifyLeadConfirmationToken(parsed.confirmationToken, binding);
      if (!verified) return invalidConfirmationState();
      const result = await service.updateConfirmedDuplicate?.(parsed.leadId, parsed.input, actor, {
        ...verified,
        operation: "update",
        leadId: parsed.leadId,
      });
      if (!result) return unexpectedErrorState("update", new Error("confirmation flow unavailable"), actor.userId);
      leadId = result.leadId;
    } else {
      leadId = (await service.update(parsed.leadId, parsed.input, actor)).id;
    }
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return {
      status: "success",
      message: "Lead updated successfully.",
      leadId,
    };
  } catch (error) {
    if (error instanceof LeadDuplicateError) {
      const parsed = parseUpdateLeadForm(formData);
      return duplicateWarningState(error, {
        actorId: actor.userId,
        operation: "update",
        leadId: parsed.leadId,
        submission: parsed.input,
      });
    }
    return knownErrorState(error) ?? unexpectedErrorState("update", error, actor.userId);
  }
}

export async function archiveLeadAction(_state: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseDeleteLeadForm(formData);
    await service.softDelete(parsed.leadId, actor);
    revalidatePath("/leads");
    revalidatePath(`/leads/${parsed.leadId}`);
    return {
      status: "success",
      message: "Lead archived successfully.",
      leadId: parsed.leadId,
      redirectTo: "/leads",
    };
  } catch (error) {
    return knownErrorState(error) ?? unexpectedErrorState("soft_delete", error, actor.userId);
  }
}

export async function restoreLeadAction(_state: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseDeleteLeadForm(formData);
    await service.restore(parsed.leadId, actor);
    revalidatePath("/leads");
    revalidatePath(`/leads/${parsed.leadId}`);
    return {
      status: "success",
      message: "Lead restored successfully.",
      leadId: parsed.leadId,
      redirectTo: "/leads",
    };
  } catch (error) {
    return knownErrorState(error) ?? unexpectedErrorState("soft_delete", error, actor.userId);
  }
}
