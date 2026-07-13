"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CompanyFormState } from "./form-state";
import {
  createCompanyConfirmationToken,
  verifyCompanyConfirmationToken,
  type CompanyConfirmationBinding,
} from "@/lib/companies/company-confirmation";
import {
  parseCreateCompanyForm,
  parseDeleteCompanyForm,
  parseUpdateCompanyForm,
} from "@/lib/companies/company-form";
import { CompanyRepositoryNotFoundError } from "@/lib/companies/company.repository";
import {
  CompanyDuplicateError,
  CompanyNotFoundError,
  CompanyPermissionError,
} from "@/lib/companies/company.service";
import {
  CompanyMutationAuthError,
  createCompanyMutationContext,
  type CompanyMutationContext,
} from "@/lib/companies/company.server";
import { logger } from "@/lib/logger";

const duplicateCandidateLimit = 20;

function validationState(error: z.ZodError): CompanyFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }
  return {
    status: "validation_error",
    message: "Check the highlighted company fields.",
    fieldErrors,
  };
}

function authErrorState(error: CompanyMutationAuthError): CompanyFormState {
  if (error.code === "inactive") {
    return {
      status: "permission_error",
      message: "Your account is inactive and cannot change companies.",
    };
  }
  if (error.code === "unauthenticated") {
    return {
      status: "permission_error",
      message: "Sign in before changing company records.",
    };
  }
  return {
    status: "error",
    message: "Company mutations are temporarily unavailable.",
  };
}

async function mutationContext(): Promise<
  { context: CompanyMutationContext } | { state: CompanyFormState }
> {
  try {
    return { context: await createCompanyMutationContext() };
  } catch (error) {
    if (error instanceof CompanyMutationAuthError) return { state: authErrorState(error) };
    logger.error("Company mutation context failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      state: {
        status: "error",
        message: "Company mutations are temporarily unavailable.",
      },
    };
  }
}

function knownErrorState(error: unknown): CompanyFormState | null {
  if (error instanceof z.ZodError) return validationState(error);
  if (error instanceof CompanyPermissionError) {
    return { status: "permission_error", message: "You cannot change this company." };
  }
  if (
    error instanceof CompanyNotFoundError ||
    error instanceof CompanyRepositoryNotFoundError
  ) {
    return { status: "not_found", message: "The company could not be found." };
  }
  return null;
}

function invalidConfirmationState(): CompanyFormState {
  return {
    status: "validation_error",
    message: "The duplicate confirmation is invalid, expired, or belongs to a changed form.",
    fieldErrors: {
      confirmationToken: ["Submit the form again to review current duplicate matches."],
    },
  };
}

function duplicateWarningState(
  error: CompanyDuplicateError,
  binding: CompanyConfirmationBinding,
): CompanyFormState {
  try {
    return {
      status: "duplicate_warning",
      message: "A likely duplicate company exists. Review the warning before creating anyway.",
      duplicateCandidateIds: error.candidateIds.slice(0, duplicateCandidateLimit),
      confirmationToken: createCompanyConfirmationToken(binding),
    };
  } catch (tokenError) {
    return unexpectedErrorState(binding.operation, tokenError, binding.actorId);
  }
}

function unexpectedErrorState(
  operation: "create" | "update" | "soft_delete",
  error: unknown,
  userId?: string,
): CompanyFormState {
  logger.error("Company mutation failed", {
    operation,
    userId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return {
    status: "error",
    message: "The company could not be saved. Try again or contact an administrator.",
  };
}

export async function createCompanyAction(
  _state: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseCreateCompanyForm(formData);
    const binding: CompanyConfirmationBinding = {
      actorId: actor.userId,
      operation: "create",
      submission: parsed.input,
    };
    let companyId: string;
    let alreadyConsumed = false;
    if (parsed.confirmationToken) {
      const verified = verifyCompanyConfirmationToken(parsed.confirmationToken, binding);
      if (!verified) return invalidConfirmationState();
      const result = await service.createConfirmedDuplicate(parsed.input, actor, {
        ...verified,
        operation: "create",
      });
      companyId = result.companyId;
      alreadyConsumed = result.status === "already_consumed";
    } else {
      companyId = (await service.create(parsed.input, actor)).id;
    }
    revalidatePath("/companies");
    return {
      status: "success",
      message: alreadyConsumed
        ? "This confirmed company was already created. Returning the original result."
        : "Company created successfully.",
      companyId,
      redirectTo: `/companies/${companyId}`,
    };
  } catch (error) {
    if (error instanceof CompanyDuplicateError) {
      const parsed = parseCreateCompanyForm(formData);
      return duplicateWarningState(error, {
        actorId: actor.userId,
        operation: "create",
        submission: parsed.input,
      });
    }
    return knownErrorState(error) ?? unexpectedErrorState("create", error, actor.userId);
  }
}

export async function updateCompanyAction(
  _state: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseUpdateCompanyForm(formData);
    const binding: CompanyConfirmationBinding = {
      actorId: actor.userId,
      operation: "update",
      companyId: parsed.companyId,
      submission: parsed.input,
    };
    let companyId: string;
    let alreadyConsumed = false;
    if (parsed.confirmationToken) {
      const verified = verifyCompanyConfirmationToken(parsed.confirmationToken, binding);
      if (!verified) return invalidConfirmationState();
      const result = await service.updateConfirmedDuplicate(
        parsed.companyId,
        parsed.input,
        actor,
        {
          ...verified,
          operation: "update",
          companyId: parsed.companyId,
        },
      );
      companyId = result.companyId;
      alreadyConsumed = result.status === "already_consumed";
    } else {
      companyId = (await service.update(parsed.companyId, parsed.input, actor)).id;
    }
    revalidatePath("/companies");
    revalidatePath(`/companies/${companyId}`);
    return {
      status: "success",
      message: alreadyConsumed
        ? "This confirmed update was already applied."
        : "Company updated successfully.",
      companyId,
    };
  } catch (error) {
    if (error instanceof CompanyDuplicateError) {
      const parsed = parseUpdateCompanyForm(formData);
      return duplicateWarningState(error, {
        actorId: actor.userId,
        operation: "update",
        companyId: parsed.companyId,
        submission: parsed.input,
      });
    }
    return knownErrorState(error) ?? unexpectedErrorState("update", error, actor.userId);
  }
}

export async function softDeleteCompanyAction(
  _state: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseDeleteCompanyForm(formData);
    await service.softDelete(parsed.companyId, actor);
    revalidatePath("/companies");
    revalidatePath(`/companies/${parsed.companyId}`);
    return {
      status: "success",
      message: "Company deleted successfully.",
      companyId: parsed.companyId,
      redirectTo: "/companies",
    };
  } catch (error) {
    return (
      knownErrorState(error) ?? unexpectedErrorState("soft_delete", error, actor.userId)
    );
  }
}
