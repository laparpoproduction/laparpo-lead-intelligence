"use server";

import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { projectLeadFollowUpQueue } from "@/lib/leads/lead-follow-up.projection";
import {
  LeadFollowUpUnavailableError,
  LeadPermissionError,
} from "@/lib/leads/lead.service";
import {
  createLeadMutationContext,
  LeadMutationAuthError,
} from "@/lib/leads/lead.server";
import type { LeadFollowUpQueueActionState } from "./follow-up-state";

const operation = "generate_lead_follow_up_queue";

function safeFailure(
  status: Exclude<LeadFollowUpQueueActionState["status"], "idle" | "success">,
): LeadFollowUpQueueActionState {
  return {
    status,
    message:
      status === "permission_error"
        ? "Sign in with an active account to review follow-up priorities."
        : status === "unavailable"
          ? "The Lead Follow-up Queue is temporarily unavailable."
          : "The Lead Follow-up Queue could not be generated.",
  };
}

function logOutcome(
  level: "info" | "warn" | "error",
  requestId: string,
  outcome: string,
  context: Record<string, string | number | undefined> = {},
) {
  logger[level]("Lead follow-up queue generation", {
    operation,
    outcome,
    requestId,
    ...context,
  });
}

export async function generateLeadFollowUpQueueAction(
  _state: LeadFollowUpQueueActionState,
  _formData: FormData,
): Promise<LeadFollowUpQueueActionState> {
  void _state;
  void _formData;
  const requestId = randomUUID();
  const startedAt = Date.now();

  let context: Awaited<ReturnType<typeof createLeadMutationContext>>;
  try {
    context = await createLeadMutationContext();
  } catch (error) {
    if (error instanceof LeadMutationAuthError) {
      const permissionFailure =
        error.code === "unauthenticated" || error.code === "inactive";
      logOutcome("warn", requestId, error.code);
      return safeFailure(permissionFailure ? "permission_error" : "unavailable");
    }
    logOutcome("error", requestId, "authentication_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return safeFailure("unexpected");
  }

  const { actor, service } = context;
  try {
    const authoritativeNow = new Date();
    const readModel = await service.getFollowUpPriorityReadModel(
      actor,
      authoritativeNow,
    );
    const queue = projectLeadFollowUpQueue(readModel);
    logOutcome("info", requestId, "succeeded", {
      actorId: actor.userId,
      eligibleCount: queue.eligibleAccessibleLeadCount,
      attentionCount: queue.configuredAttentionLeadCount,
      analyzedCandidateCount: queue.analyzedCandidateCount,
      durationMs: Date.now() - startedAt,
    });
    return {
      status: "success",
      message:
        "Follow-up priorities reviewed from accessible CRM metadata. No CRM data was changed.",
      queue,
    };
  } catch (error) {
    if (
      error instanceof LeadFollowUpUnavailableError ||
      error instanceof LeadPermissionError
    ) {
      logOutcome("warn", requestId, "queue_unavailable", {
        actorId: actor.userId,
      });
      return safeFailure("unavailable");
    }
    logOutcome("error", requestId, "unexpected", {
      actorId: actor.userId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return safeFailure("unexpected");
  }
}
