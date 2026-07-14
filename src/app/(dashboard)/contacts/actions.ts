"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ContactFormState } from "./form-state";
import {
  createContactConfirmationToken,
  verifyContactConfirmationToken,
  type ContactConfirmationBinding,
} from "@/lib/contacts/contact-confirmation";
import {
  parseCreateContactForm,
  parseDeleteContactForm,
  parseUpdateContactForm,
} from "@/lib/contacts/contact-form-data";
import { ContactRepositoryNotFoundError } from "@/lib/contacts/contact.repository";
import {
  ContactDuplicateError,
  ContactNotFoundError,
  ContactPermissionError,
  ContactValidationError,
} from "@/lib/contacts/contact.service";
import {
  ContactMutationAuthError,
  createContactMutationContext,
  type ContactMutationContext,
} from "@/lib/contacts/contact.server";
import { logger } from "@/lib/logger";

const duplicateCandidateLimit = 20;

function issuesState(issues: z.ZodIssue[]): ContactFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
  }
  return {
    status: "validation_error",
    message: "Check the highlighted contact fields.",
    fieldErrors,
  };
}

function authErrorState(error: ContactMutationAuthError): ContactFormState {
  if (error.code === "inactive") {
    return {
      status: "permission_error",
      message: "Your account is inactive and cannot change contacts.",
    };
  }
  if (error.code === "unauthenticated") {
    return {
      status: "permission_error",
      message: "Sign in before changing contact records.",
    };
  }
  return {
    status: "error",
    message: "Contact mutations are temporarily unavailable.",
  };
}

async function mutationContext(): Promise<
  { context: ContactMutationContext } | { state: ContactFormState }
> {
  try {
    return { context: await createContactMutationContext() };
  } catch (error) {
    if (error instanceof ContactMutationAuthError) {
      return { state: authErrorState(error) };
    }
    logger.error("Contact mutation context failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      state: {
        status: "error",
        message: "Contact mutations are temporarily unavailable.",
      },
    };
  }
}

function knownErrorState(error: unknown): ContactFormState | null {
  if (error instanceof z.ZodError) return issuesState(error.issues);
  if (error instanceof ContactValidationError) return issuesState(error.issues);
  if (error instanceof ContactPermissionError) {
    return { status: "permission_error", message: "You cannot change this contact." };
  }
  if (
    error instanceof ContactNotFoundError ||
    error instanceof ContactRepositoryNotFoundError
  ) {
    return { status: "not_found", message: "The contact could not be found." };
  }
  return null;
}

function invalidConfirmationState(): ContactFormState {
  return {
    status: "validation_error",
    message: "The duplicate confirmation is invalid, expired, or belongs to a changed form.",
    fieldErrors: {
      confirmationToken: ["Submit the form again to review current duplicate matches."],
    },
  };
}

function unexpectedErrorState(
  operation: "create" | "update" | "soft_delete",
  error: unknown,
  actorId?: string,
): ContactFormState {
  logger.error("Contact mutation failed", {
    operation,
    actorId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return {
    status: "error",
    message: "The contact could not be saved. Try again or contact an administrator.",
  };
}

function duplicateWarningState(
  error: ContactDuplicateError,
  binding: ContactConfirmationBinding,
): ContactFormState {
  try {
    return {
      status: "duplicate_warning",
      message: "A likely duplicate contact exists. Review the warning before continuing.",
      duplicateCandidateIds: error.candidateIds.slice(0, duplicateCandidateLimit),
      confirmationToken: createContactConfirmationToken(binding),
    };
  } catch (tokenError) {
    return unexpectedErrorState(binding.operation, tokenError, binding.actorId);
  }
}

export async function createContactAction(
  _state: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseCreateContactForm(formData);
    const binding: ContactConfirmationBinding = {
      actorId: actor.userId,
      operation: "create",
      submission: parsed.input,
    };
    let contactId: string;
    let alreadyProcessed = false;

    if (parsed.confirmationToken) {
      const verified = verifyContactConfirmationToken(
        parsed.confirmationToken,
        binding,
      );
      if (!verified) return invalidConfirmationState();
      const result = await service.createConfirmedDuplicate(parsed.input, actor, {
        ...verified,
        operation: "create",
      });
      contactId = result.contactId;
      alreadyProcessed = result.status === "already_processed";
    } else {
      contactId = (await service.create(parsed.input, actor)).id;
    }

    revalidatePath("/contacts");
    return {
      status: alreadyProcessed ? "already_processed" : "success",
      message: alreadyProcessed
        ? "This confirmed contact was already created. Returning the original result."
        : "Contact created successfully.",
      contactId,
      redirectTo: `/contacts/${contactId}`,
    };
  } catch (error) {
    if (error instanceof ContactDuplicateError) {
      const parsed = parseCreateContactForm(formData);
      return duplicateWarningState(error, {
        actorId: actor.userId,
        operation: "create",
        submission: parsed.input,
      });
    }
    return knownErrorState(error) ?? unexpectedErrorState("create", error, actor.userId);
  }
}

export async function updateContactAction(
  _state: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseUpdateContactForm(formData);
    const binding: ContactConfirmationBinding = {
      actorId: actor.userId,
      operation: "update",
      contactId: parsed.contactId,
      submission: parsed.input,
    };
    let contactId: string;
    let alreadyProcessed = false;

    if (parsed.confirmationToken) {
      const verified = verifyContactConfirmationToken(
        parsed.confirmationToken,
        binding,
      );
      if (!verified) return invalidConfirmationState();
      const result = await service.updateConfirmedDuplicate(
        parsed.contactId,
        parsed.input,
        actor,
        {
          ...verified,
          operation: "update",
          contactId: parsed.contactId,
        },
      );
      contactId = result.contactId;
      alreadyProcessed = result.status === "already_processed";
    } else {
      contactId = (await service.update(parsed.contactId, parsed.input, actor)).id;
    }

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
    return {
      status: alreadyProcessed ? "already_processed" : "success",
      message: alreadyProcessed
        ? "This confirmed contact update was already applied."
        : "Contact updated successfully.",
      contactId,
      redirectTo: `/contacts/${contactId}`,
    };
  } catch (error) {
    if (error instanceof ContactDuplicateError) {
      const parsed = parseUpdateContactForm(formData);
      return duplicateWarningState(error, {
        actorId: actor.userId,
        operation: "update",
        contactId: parsed.contactId,
        submission: parsed.input,
      });
    }
    return knownErrorState(error) ?? unexpectedErrorState("update", error, actor.userId);
  }
}

export async function softDeleteContactAction(
  _state: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const resolved = await mutationContext();
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseDeleteContactForm(formData);
    await service.softDelete(parsed.contactId, actor);
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${parsed.contactId}`);
    return {
      status: "success",
      message: "Contact archived successfully.",
      contactId: parsed.contactId,
      redirectTo: "/contacts",
    };
  } catch (error) {
    return knownErrorState(error) ?? unexpectedErrorState("soft_delete", error, actor.userId);
  }
}
