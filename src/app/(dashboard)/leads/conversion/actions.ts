"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { LeadConversionActionState } from "./form-state";
import {
  createMutationRequest,
  logMutationOutcome,
  type MutationOutcome,
  type MutationRequest,
} from "@/lib/mutation-audit";
import { parseLeadConversionForm } from "@/lib/opportunities/opportunity-form";
import {
  LeadConversionEligibilityError,
  LeadConversionNotFoundError,
  LeadConversionPermissionError,
  LeadConversionUnavailableError,
  LeadConversionValidationError,
} from "@/lib/opportunities/opportunity.service";
import {
  createLeadConversionContext,
  LeadConversionAuthError,
} from "@/lib/opportunities/opportunity.server";

function validationState(
  issues: z.ZodIssue[],
): LeadConversionActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const field =
      typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }
  return {
    status: "validation_error",
    message: "Check the highlighted conversion fields.",
    fieldErrors,
  };
}

function authState(error: LeadConversionAuthError): LeadConversionActionState {
  if (error.code === "unauthenticated") {
    return {
      status: "unauthenticated",
      message: "Sign in before converting a Lead.",
    };
  }
  if (error.code === "inactive") {
    return {
      status: "inactive",
      message: "Your account is inactive and cannot convert Leads.",
    };
  }
  return {
    status: "unavailable",
    message: "Lead conversion is temporarily unavailable.",
  };
}

function finish(
  request: MutationRequest,
  state: LeadConversionActionState,
  outcome: MutationOutcome,
  context: { actorId?: string; resourceId?: string; errorName?: string } = {},
): LeadConversionActionState {
  logMutationOutcome(request, outcome, context);
  return state;
}

export async function convertLeadToOpportunityAction(
  _state: LeadConversionActionState,
  formData: FormData,
): Promise<LeadConversionActionState> {
  const request = createMutationRequest("convert_lead", "lead_conversion");
  let context;
  try {
    context = await createLeadConversionContext(request);
  } catch (error) {
    if (error instanceof LeadConversionAuthError) {
      return finish(
        request,
        authState(error),
        error.code === "unauthenticated"
          ? "unauthenticated"
          : error.code === "inactive"
            ? "inactive"
            : "unavailable",
      );
    }
    return finish(request, {
      status: "unavailable",
      message: "Lead conversion is temporarily unavailable.",
    }, "infrastructure", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  try {
    const input = parseLeadConversionForm(formData);
    const result = await context.service.convert(input, context.actor);
    revalidatePath("/leads");
    revalidatePath(`/leads/${result.leadId}`);
    return finish(request, {
      status:
        result.status === "already_converted"
          ? "already_converted"
          : "success",
      message:
        result.status === "already_converted"
          ? "This Lead was already converted safely."
          : "Lead converted to an Opportunity successfully.",
      leadId: result.leadId,
      opportunityId: result.opportunityId,
    }, result.status === "already_converted" ? "already_applied" : "succeeded", {
      actorId: context.actor.userId,
      resourceId: result.leadId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return finish(
        request,
        validationState(error.issues),
        "validation",
        { actorId: context.actor.userId },
      );
    }
    if (error instanceof LeadConversionValidationError) {
      return finish(
        request,
        validationState(error.issues),
        "validation",
        { actorId: context.actor.userId },
      );
    }
    if (error instanceof LeadConversionPermissionError) {
      return finish(request, {
        status: "forbidden",
        message: "You cannot convert this Lead.",
      }, "forbidden", { actorId: context.actor.userId });
    }
    if (error instanceof LeadConversionNotFoundError) {
      return finish(request, {
        status: "not_found",
        message: "The Lead could not be found.",
      }, "not_found", { actorId: context.actor.userId });
    }
    if (error instanceof LeadConversionEligibilityError) {
      if (error.reason === "legacy") {
        return finish(request, {
          status: "legacy_unresolved",
          message:
            "This historical converted Lead has no verified conversion relationship. It requires manual reconciliation.",
        }, "ineligible", { actorId: context.actor.userId });
      }
      return finish(request, {
        status: "ineligible",
        message:
          error.reason === "terminal"
            ? "Lost or disqualified Leads cannot be converted."
            : "This Lead is not eligible for conversion.",
      }, "ineligible", { actorId: context.actor.userId });
    }
    if (error instanceof LeadConversionUnavailableError) {
      return finish(request, {
        status: "unavailable",
        message: "Lead conversion is temporarily unavailable. Try again.",
      }, "unavailable", { actorId: context.actor.userId });
    }
    return finish(request, {
      status: "unavailable",
      message: "Lead conversion is temporarily unavailable. Try again.",
    }, "unexpected", {
      actorId: context.actor.userId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
