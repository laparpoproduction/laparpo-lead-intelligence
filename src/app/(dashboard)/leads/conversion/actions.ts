"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { LeadConversionActionState } from "./form-state";
import { logger } from "@/lib/logger";
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

export async function convertLeadToOpportunityAction(
  _state: LeadConversionActionState,
  formData: FormData,
): Promise<LeadConversionActionState> {
  let context;
  try {
    context = await createLeadConversionContext();
  } catch (error) {
    if (error instanceof LeadConversionAuthError) return authState(error);
    logger.error("Lead conversion context failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      status: "unavailable",
      message: "Lead conversion is temporarily unavailable.",
    };
  }

  try {
    const input = parseLeadConversionForm(formData);
    const result = await context.service.convert(input, context.actor);
    revalidatePath("/leads");
    revalidatePath(`/leads/${result.leadId}`);
    return {
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
    };
  } catch (error) {
    if (error instanceof z.ZodError) return validationState(error.issues);
    if (error instanceof LeadConversionValidationError) {
      return validationState(error.issues);
    }
    if (error instanceof LeadConversionPermissionError) {
      return {
        status: "forbidden",
        message: "You cannot convert this Lead.",
      };
    }
    if (error instanceof LeadConversionNotFoundError) {
      return {
        status: "not_found",
        message: "The Lead could not be found.",
      };
    }
    if (error instanceof LeadConversionEligibilityError) {
      if (error.reason === "legacy") {
        return {
          status: "legacy_unresolved",
          message:
            "This historical converted Lead has no verified conversion relationship. It requires manual reconciliation.",
        };
      }
      return {
        status: "ineligible",
        message:
          error.reason === "terminal"
            ? "Lost or disqualified Leads cannot be converted."
            : "This Lead is not eligible for conversion.",
      };
    }
    if (error instanceof LeadConversionUnavailableError) {
      return {
        status: "unavailable",
        message: "Lead conversion is temporarily unavailable. Try again.",
      };
    }
    logger.error("Lead conversion action failed", {
      actorId: context.actor.userId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      status: "unavailable",
      message: "Lead conversion is temporarily unavailable. Try again.",
    };
  }
}
