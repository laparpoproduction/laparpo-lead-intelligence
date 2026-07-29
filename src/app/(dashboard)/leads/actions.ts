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
import {
  createMutationRequest,
  logMutationOutcome,
  type MutationOutcome,
  type MutationRequest,
} from "@/lib/mutation-audit";

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

async function mutationContext(request: MutationRequest): Promise<{ context: LeadMutationContext } | { state: LeadFormState }> {
  try {
    return { context: await createLeadMutationContext(request) };
  } catch (error) {
    if (error instanceof LeadMutationAuthError) {
      logMutationOutcome(
        request,
        error.code === "unauthenticated"
          ? "unauthenticated"
          : error.code === "inactive"
            ? "inactive"
            : "unavailable",
      );
      return { state: authErrorState(error) };
    }
    logMutationOutcome(request, "infrastructure", {
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

function duplicateWarningState(
  error: LeadDuplicateError,
  binding: LeadConfirmationBinding,
): LeadFormState {
  try {
    return {
      status: "duplicate_warning",
      message: "A likely duplicate lead exists. Review the warning before continuing.",
      duplicateCandidateIds: error.candidateIds.slice(0, duplicateCandidateLimit),
      confirmationToken: createLeadConfirmationToken(binding),
    };
  } catch {
    return unexpectedErrorState();
  }
}

function unexpectedErrorState(): LeadFormState {
  return {
    status: "error",
    message: "The lead could not be saved. Try again or contact an administrator.",
  };
}

function outcomeForState(state: LeadFormState): MutationOutcome {
  if (state.status === "validation_error") return "validation";
  if (state.status === "permission_error") return "forbidden";
  if (state.status === "not_found") return "not_found";
  if (state.status === "duplicate_warning") return "confirmation_required";
  if (state.status === "already_processed") return "already_applied";
  if (state.status === "success") return "succeeded";
  return "unexpected";
}

function finish(
  request: MutationRequest,
  state: LeadFormState,
  context: { actorId?: string; resourceId?: string; outcome?: MutationOutcome } = {},
): LeadFormState {
  const { outcome, ...logContext } = context;
  logMutationOutcome(request, outcome ?? outcomeForState(state), logContext);
  return state;
}

export async function createLeadAction(_state: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const request = createMutationRequest("create_lead", "lead");
  const resolved = await mutationContext(request);
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
      if (!verified) {
        return finish(request, invalidConfirmationState(), {
          actorId: actor.userId,
          outcome: "invalid_confirmation",
        });
      }
      const result = await service.createConfirmedDuplicate(parsed.input, actor, {
        ...verified,
        operation: "create",
      });
      leadId = result.leadId;
      revalidatePath("/leads");
      return finish(request, {
        status: result.status === "already_processed" ? "already_processed" : "success",
        message: result.status === "already_processed"
          ? "This confirmed lead was already created."
          : "Lead created successfully.",
        leadId,
        redirectTo: `/leads/${leadId}`,
      }, {
        actorId: actor.userId,
        resourceId: leadId,
        outcome: result.status === "already_processed"
          ? "already_applied"
          : "succeeded",
      });
    } else {
      leadId = (await service.create(parsed.input, actor)).id;
    }
    revalidatePath("/leads");
    return finish(request, {
      status: "success",
      message: "Lead created successfully.",
      leadId,
      redirectTo: `/leads/${leadId}`,
    }, { actorId: actor.userId, resourceId: leadId });
  } catch (error) {
    if (error instanceof LeadDuplicateError) {
      const parsed = parseCreateLeadForm(formData);
      return finish(request, duplicateWarningState(error, {
        actorId: actor.userId,
        operation: "create",
        submission: parsed.input,
      }), { actorId: actor.userId });
    }
    const known = knownErrorState(error);
    if (known) return finish(request, known, { actorId: actor.userId });
    logMutationOutcome(request, "unexpected", {
      actorId: actor.userId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return unexpectedErrorState();
  }
}

export async function updateLeadAction(_state: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const request = createMutationRequest("update_lead", "lead");
  const resolved = await mutationContext(request);
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
      if (!verified) {
        return finish(request, invalidConfirmationState(), {
          actorId: actor.userId,
          resourceId: parsed.leadId,
          outcome: "invalid_confirmation",
        });
      }
      const result = await service.updateConfirmedDuplicate(parsed.leadId, parsed.input, actor, {
        ...verified,
        operation: "update",
        leadId: parsed.leadId,
      });
      leadId = result.leadId;
      revalidatePath("/leads");
      revalidatePath(`/leads/${leadId}`);
      return finish(request, {
        status: result.status === "already_processed" ? "already_processed" : "success",
        message: result.status === "already_processed"
          ? "This confirmed lead update was already applied."
          : "Lead updated successfully.",
        leadId,
      }, {
        actorId: actor.userId,
        resourceId: leadId,
        outcome: result.status === "already_processed"
          ? "already_applied"
          : "succeeded",
      });
    } else {
      leadId = (await service.update(parsed.leadId, parsed.input, actor)).id;
    }
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return finish(request, {
      status: "success",
      message: "Lead updated successfully.",
      leadId,
    }, { actorId: actor.userId, resourceId: leadId });
  } catch (error) {
    if (error instanceof LeadDuplicateError) {
      const parsed = parseUpdateLeadForm(formData);
      return finish(request, duplicateWarningState(error, {
        actorId: actor.userId,
        operation: "update",
        leadId: parsed.leadId,
        submission: parsed.input,
      }), {
        actorId: actor.userId,
        resourceId: parsed.leadId,
      });
    }
    const known = knownErrorState(error);
    if (known) return finish(request, known, { actorId: actor.userId });
    logMutationOutcome(request, "unexpected", {
      actorId: actor.userId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return unexpectedErrorState();
  }
}

export async function archiveLeadAction(_state: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const request = createMutationRequest("archive_lead", "lead");
  const resolved = await mutationContext(request);
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseDeleteLeadForm(formData);
    await service.softDelete(parsed.leadId, actor);
    revalidatePath("/leads");
    revalidatePath(`/leads/${parsed.leadId}`);
    return finish(request, {
      status: "success",
      message: "Lead archived successfully.",
      leadId: parsed.leadId,
      redirectTo: "/leads",
    }, { actorId: actor.userId, resourceId: parsed.leadId });
  } catch (error) {
    const known = knownErrorState(error);
    if (known) return finish(request, known, { actorId: actor.userId });
    logMutationOutcome(request, "unexpected", {
      actorId: actor.userId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return unexpectedErrorState();
  }
}

export async function restoreLeadAction(_state: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const request = createMutationRequest("restore_lead", "lead");
  const resolved = await mutationContext(request);
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseDeleteLeadForm(formData);
    await service.restore(parsed.leadId, actor);
    revalidatePath("/leads");
    revalidatePath(`/leads/${parsed.leadId}`);
    return finish(request, {
      status: "success",
      message: "Lead restored successfully.",
      leadId: parsed.leadId,
      redirectTo: "/leads",
    }, { actorId: actor.userId, resourceId: parsed.leadId });
  } catch (error) {
    const known = knownErrorState(error);
    if (known) return finish(request, known, { actorId: actor.userId });
    logMutationOutcome(request, "unexpected", {
      actorId: actor.userId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return unexpectedErrorState();
  }
}
