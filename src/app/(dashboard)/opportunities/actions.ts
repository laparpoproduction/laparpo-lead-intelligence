"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OpportunityMutationActionState } from "./form-state";
import {
  createMutationRequest,
  logMutationOutcome,
  type MutationOperation,
  type MutationOutcome,
  type MutationRequest,
} from "@/lib/mutation-audit";
import {
  parseOpportunityExpectedCloseMutationForm,
  parseOpportunityLostMutationForm,
  parseOpportunityOwnerMutationForm,
  parseOpportunityProbabilityMutationForm,
  parseOpportunityStageMutationForm,
  parseOpportunityVersionedMutationForm,
} from "@/lib/opportunities/opportunity-form";
import {
  OpportunityMutationConflictError,
  OpportunityMutationEligibilityError,
  OpportunityMutationNotFoundError,
  OpportunityMutationPermissionError,
  OpportunityMutationUnavailableError,
  OpportunityMutationValidationError,
} from "@/lib/opportunities/opportunity.service";
import {
  createOpportunityContext,
  LeadConversionAuthError,
  type LeadConversionContext,
} from "@/lib/opportunities/opportunity.server";
import type {
  LeadConversionActor,
  OpportunityMutationResult,
} from "@/lib/opportunities/opportunity.types";

type Operation =
  | "change_stage"
  | "assign_owner"
  | "set_expected_close"
  | "override_probability"
  | "clear_probability"
  | "mark_won"
  | "mark_lost";

const correlatedOperations: Record<Operation, MutationOperation> = {
  change_stage: "change_opportunity_stage",
  assign_owner: "assign_opportunity_owner",
  set_expected_close: "set_opportunity_expected_close",
  override_probability: "override_opportunity_probability",
  clear_probability: "clear_opportunity_probability",
  mark_won: "mark_opportunity_won",
  mark_lost: "mark_opportunity_lost",
};

function validationState(
  issues: z.ZodIssue[],
): OpportunityMutationActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const field =
      typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }
  return {
    status: "validation_error",
    message: "Check the Opportunity mutation fields.",
    fieldErrors,
  };
}

function authState(
  error: LeadConversionAuthError,
): OpportunityMutationActionState {
  if (error.code === "unauthenticated") {
    return {
      status: "unauthenticated",
      message: "Sign in before changing an Opportunity.",
    };
  }
  if (error.code === "inactive") {
    return {
      status: "inactive",
      message: "Your account is inactive and cannot change Opportunities.",
    };
  }
  return {
    status: "unavailable",
    message: "Opportunity mutations are temporarily unavailable.",
  };
}

async function mutationContext(request: MutationRequest): Promise<
  { context: LeadConversionContext } | { state: OpportunityMutationActionState }
> {
  try {
    return { context: await createOpportunityContext(request) };
  } catch (error) {
    if (error instanceof LeadConversionAuthError) {
      logMutationOutcome(
        request,
        error.code === "unauthenticated"
          ? "unauthenticated"
          : error.code === "inactive"
            ? "inactive"
            : "unavailable",
      );
      return { state: authState(error) };
    }
    logMutationOutcome(request, "infrastructure", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      state: {
        status: "unavailable",
        message: "Opportunity mutations are temporarily unavailable.",
      },
    };
  }
}

function knownErrorState(
  error: unknown,
): OpportunityMutationActionState | null {
  if (error instanceof z.ZodError) return validationState(error.issues);
  if (error instanceof OpportunityMutationValidationError) {
    return validationState(error.issues);
  }
  if (error instanceof OpportunityMutationPermissionError) {
    return {
      status: "forbidden",
      message: "You cannot change this Opportunity.",
    };
  }
  if (error instanceof OpportunityMutationNotFoundError) {
    return {
      status: "not_found",
      message: "The Opportunity could not be found.",
    };
  }
  if (error instanceof OpportunityMutationConflictError) {
    return {
      status: "conflict",
      message:
        "This Opportunity was updated by someone else. The latest information has been loaded. Review it and try again.",
    };
  }
  if (error instanceof OpportunityMutationEligibilityError) {
    return {
      status: "ineligible",
      message:
        error.reason === "terminal"
          ? "A terminal Opportunity cannot be changed by this workflow."
          : "The selected Opportunity owner is not active.",
    };
  }
  if (error instanceof OpportunityMutationUnavailableError) {
    return {
      status: "unavailable",
      message: "The Opportunity could not be changed. Try again.",
    };
  }
  return null;
}

function revalidateOpportunity(opportunityId: string): void {
  revalidatePath("/opportunities");
  revalidatePath("/opportunities/pipeline");
  revalidatePath(`/opportunities/${opportunityId}`);
}

function resultState(
  result: OpportunityMutationResult,
): OpportunityMutationActionState {
  revalidateOpportunity(result.opportunity.id);
  return {
    status: result.status === "applied" ? "success" : "already_applied",
    message:
      result.status === "applied"
        ? "Opportunity updated successfully."
        : "This Opportunity mutation was already applied safely.",
    opportunityId: result.opportunity.id,
    updatedAt: result.opportunity.updatedAt,
  };
}

function outcomeForState(
  state: OpportunityMutationActionState,
): MutationOutcome {
  if (state.status === "validation_error") return "validation";
  if (state.status === "unauthenticated") return "unauthenticated";
  if (state.status === "inactive") return "inactive";
  if (state.status === "forbidden") return "forbidden";
  if (state.status === "not_found") return "not_found";
  if (state.status === "conflict") return "conflict";
  if (state.status === "ineligible") return "ineligible";
  if (state.status === "already_applied") return "already_applied";
  if (state.status === "success") return "succeeded";
  return "unavailable";
}

function finish(
  request: MutationRequest,
  state: OpportunityMutationActionState,
  context: {
    actorId?: string;
    resourceId?: string;
    errorName?: string;
    outcome?: MutationOutcome;
  } = {},
): OpportunityMutationActionState {
  const { outcome, ...logContext } = context;
  logMutationOutcome(request, outcome ?? outcomeForState(state), logContext);
  return state;
}

async function runMutation<T>(
  operation: Operation,
  formData: FormData,
  parse: (formData: FormData) => T,
  invoke: (
    context: LeadConversionContext,
    input: T,
    actor: LeadConversionActor,
  ) => Promise<OpportunityMutationResult>,
): Promise<OpportunityMutationActionState> {
  const request = createMutationRequest(
    correlatedOperations[operation],
    "opportunity",
  );
  const resolved = await mutationContext(request);
  if ("state" in resolved) return resolved.state;
  const { context } = resolved;

  try {
    const input = parse(formData);
    const state = resultState(await invoke(context, input, context.actor));
    return finish(request, state, {
      actorId: context.actor.userId,
      resourceId: state.opportunityId,
    });
  } catch (error) {
    const known = knownErrorState(error);
    if (known) {
      return finish(request, known, { actorId: context.actor.userId });
    }
    return finish(request, {
      status: "unavailable",
      message: "The Opportunity could not be changed. Try again.",
    }, {
      actorId: context.actor.userId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      outcome: "unexpected",
    });
  }
}

export async function changeOpportunityStageAction(
  _state: OpportunityMutationActionState,
  formData: FormData,
): Promise<OpportunityMutationActionState> {
  return runMutation(
    "change_stage",
    formData,
    parseOpportunityStageMutationForm,
    (context, input, actor) =>
      context.service.changePipelineStage(input, actor),
  );
}

export async function assignOpportunityOwnerAction(
  _state: OpportunityMutationActionState,
  formData: FormData,
): Promise<OpportunityMutationActionState> {
  return runMutation(
    "assign_owner",
    formData,
    parseOpportunityOwnerMutationForm,
    (context, input, actor) => context.service.assignOwner(input, actor),
  );
}

export async function setOpportunityExpectedCloseDateAction(
  _state: OpportunityMutationActionState,
  formData: FormData,
): Promise<OpportunityMutationActionState> {
  return runMutation(
    "set_expected_close",
    formData,
    parseOpportunityExpectedCloseMutationForm,
    (context, input, actor) =>
      context.service.setExpectedCloseDate(input, actor),
  );
}

export async function overrideOpportunityProbabilityAction(
  _state: OpportunityMutationActionState,
  formData: FormData,
): Promise<OpportunityMutationActionState> {
  return runMutation(
    "override_probability",
    formData,
    parseOpportunityProbabilityMutationForm,
    (context, input, actor) =>
      context.service.overrideProbability(input, actor),
  );
}

export async function clearOpportunityProbabilityOverrideAction(
  _state: OpportunityMutationActionState,
  formData: FormData,
): Promise<OpportunityMutationActionState> {
  return runMutation(
    "clear_probability",
    formData,
    parseOpportunityVersionedMutationForm,
    (context, input, actor) =>
      context.service.clearProbabilityOverride(input, actor),
  );
}

export async function markOpportunityWonAction(
  _state: OpportunityMutationActionState,
  formData: FormData,
): Promise<OpportunityMutationActionState> {
  return runMutation(
    "mark_won",
    formData,
    parseOpportunityVersionedMutationForm,
    (context, input, actor) => context.service.markWon(input, actor),
  );
}

export async function markOpportunityLostAction(
  _state: OpportunityMutationActionState,
  formData: FormData,
): Promise<OpportunityMutationActionState> {
  return runMutation(
    "mark_lost",
    formData,
    parseOpportunityLostMutationForm,
    (context, input, actor) => context.service.markLost(input, actor),
  );
}
