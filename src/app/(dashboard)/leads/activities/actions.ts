"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { LeadActivityFormState } from "./form-state";
import {
  parseCreateLeadActivityForm,
  parseLeadActivityMutationForm,
  parseUpdateLeadActivityForm,
} from "@/lib/lead-activities/lead-activity-form";
import { LeadActivityRepositoryNotFoundError } from "@/lib/lead-activities/lead-activity.repository";
import {
  LeadActivityNotFoundError,
  LeadActivityPermissionError,
  LeadActivityValidationError,
} from "@/lib/lead-activities/lead-activity.service";
import {
  LeadActivityMutationAuthError,
  createLeadActivityMutationContext,
  type LeadActivityMutationContext,
} from "@/lib/lead-activities/lead-activity.server";
import {
  createMutationRequest,
  logMutationOutcome,
  type MutationOutcome,
  type MutationRequest,
} from "@/lib/mutation-audit";

function issuesState(issues: z.ZodIssue[]): LeadActivityFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }
  return {
    status: "validation_error",
    message: "Check the highlighted activity fields.",
    fieldErrors,
  };
}

function authErrorState(
  error: LeadActivityMutationAuthError,
): LeadActivityFormState {
  if (error.code === "unauthenticated") {
    return {
      status: "permission_error",
      code: "unauthenticated",
      message: "Sign in before changing Lead activities.",
    };
  }
  if (error.code === "inactive") {
    return {
      status: "permission_error",
      code: "inactive",
      message: "Your account is inactive and cannot change Lead activities.",
    };
  }
  return {
    status: "error",
    code: "unexpected",
    message: "Lead activity mutations are temporarily unavailable.",
  };
}

async function mutationContext(request: MutationRequest): Promise<
  { context: LeadActivityMutationContext } | { state: LeadActivityFormState }
> {
  try {
    return { context: await createLeadActivityMutationContext(request) };
  } catch (error) {
    if (error instanceof LeadActivityMutationAuthError) {
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
        code: "unexpected",
        message: "Lead activity mutations are temporarily unavailable.",
      },
    };
  }
}

function knownErrorState(error: unknown): LeadActivityFormState | null {
  if (error instanceof z.ZodError) return issuesState(error.issues);
  if (error instanceof LeadActivityValidationError) {
    return issuesState(error.issues);
  }
  if (error instanceof LeadActivityPermissionError) {
    return {
      status: "permission_error",
      code: "forbidden",
      message:
        "You cannot change this activity, or its parent Lead is unavailable.",
    };
  }
  if (
    error instanceof LeadActivityNotFoundError ||
    error instanceof LeadActivityRepositoryNotFoundError
  ) {
    return {
      status: "not_found",
      code: "not_found",
      message: "The Lead activity could not be found.",
    };
  }
  return null;
}

function unexpectedErrorState(): LeadActivityFormState {
  return {
    status: "error",
    code: "unexpected",
    message:
      "The Lead activity could not be saved. Try again or contact an administrator.",
  };
}

function outcomeForState(state: LeadActivityFormState): MutationOutcome {
  if (state.status === "validation_error") return "validation";
  if (state.status === "permission_error") {
    return state.code === "unauthenticated"
      ? "unauthenticated"
      : state.code === "inactive"
        ? "inactive"
        : "forbidden";
  }
  if (state.status === "not_found") return "not_found";
  if (state.status === "success") return "succeeded";
  return "unexpected";
}

function finish(
  request: MutationRequest,
  state: LeadActivityFormState,
  context: { actorId?: string; resourceId?: string; outcome?: MutationOutcome } = {},
): LeadActivityFormState {
  const { outcome, ...logContext } = context;
  logMutationOutcome(request, outcome ?? outcomeForState(state), logContext);
  return state;
}

function revalidateActiveLead(leadId: string): void {
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

function revalidateArchivedLead(leadId: string): void {
  revalidateActiveLead(leadId);
  revalidatePath("/leads/archived");
  revalidatePath(`/leads/${leadId}/activities/archived`);
}

export async function createLeadActivityAction(
  _state: LeadActivityFormState,
  formData: FormData,
): Promise<LeadActivityFormState> {
  const request = createMutationRequest(
    "create_lead_activity",
    "lead_activity",
  );
  const resolved = await mutationContext(request);
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const activity = await service.create(
      parseCreateLeadActivityForm(formData),
      actor,
    );
    revalidateActiveLead(activity.leadId);
    return finish(request, {
      status: "success",
      message: "Lead activity created successfully.",
      activityId: activity.id,
      leadId: activity.leadId,
    }, {
      actorId: actor.userId,
      resourceId: activity.id,
    });
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

export async function updateLeadActivityAction(
  _state: LeadActivityFormState,
  formData: FormData,
): Promise<LeadActivityFormState> {
  const request = createMutationRequest(
    "update_lead_activity",
    "lead_activity",
  );
  const resolved = await mutationContext(request);
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseUpdateLeadActivityForm(formData);
    const activity = await service.update(
      parsed.activityId,
      parsed.input,
      actor,
    );
    revalidateActiveLead(activity.leadId);
    return finish(request, {
      status: "success",
      message: "Lead activity updated successfully.",
      activityId: activity.id,
      leadId: activity.leadId,
    }, {
      actorId: actor.userId,
      resourceId: activity.id,
    });
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

export async function archiveLeadActivityAction(
  _state: LeadActivityFormState,
  formData: FormData,
): Promise<LeadActivityFormState> {
  const request = createMutationRequest(
    "archive_lead_activity",
    "lead_activity",
  );
  const resolved = await mutationContext(request);
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const { activityId } = parseLeadActivityMutationForm(formData);
    const archived = await service.softDelete(activityId, actor);
    revalidateArchivedLead(archived.leadId);
    return finish(request, {
      status: "success",
      message: "Lead activity archived successfully.",
      activityId,
      leadId: archived.leadId,
    }, {
      actorId: actor.userId,
      resourceId: activityId,
    });
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

export async function restoreLeadActivityAction(
  _state: LeadActivityFormState,
  formData: FormData,
): Promise<LeadActivityFormState> {
  const request = createMutationRequest(
    "restore_lead_activity",
    "lead_activity",
  );
  const resolved = await mutationContext(request);
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const { activityId } = parseLeadActivityMutationForm(formData);
    const restored = await service.restore(activityId, actor);
    revalidateArchivedLead(restored.leadId);
    return finish(request, {
      status: "success",
      message: "Lead activity restored successfully.",
      activityId,
      leadId: restored.leadId,
    }, {
      actorId: actor.userId,
      resourceId: activityId,
    });
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
