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
import {
  createMutationRequest,
  logMutationOutcome,
  type MutationOutcome,
  type MutationRequest,
} from "@/lib/mutation-audit";

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

async function mutationContext(request: MutationRequest): Promise<
  { context: ContactMutationContext } | { state: ContactFormState }
> {
  try {
    return { context: await createContactMutationContext(request) };
  } catch (error) {
    if (error instanceof ContactMutationAuthError) {
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

function unexpectedErrorState(): ContactFormState {
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
  } catch {
    return unexpectedErrorState();
  }
}

function outcomeForState(state: ContactFormState): MutationOutcome {
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
  state: ContactFormState,
  context: { actorId?: string; resourceId?: string; outcome?: MutationOutcome } = {},
): ContactFormState {
  const { outcome, ...logContext } = context;
  logMutationOutcome(request, outcome ?? outcomeForState(state), logContext);
  return state;
}

export async function createContactAction(
  _state: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const request = createMutationRequest("create_contact", "contact");
  const resolved = await mutationContext(request);
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
      contactId = result.contactId;
      alreadyProcessed = result.status === "already_processed";
    } else {
      contactId = (await service.create(parsed.input, actor)).id;
    }

    revalidatePath("/contacts");
    return finish(request, {
      status: alreadyProcessed ? "already_processed" : "success",
      message: alreadyProcessed
        ? "This confirmed contact was already created. Returning the original result."
        : "Contact created successfully.",
      contactId,
      redirectTo: `/contacts/${contactId}`,
    }, {
      actorId: actor.userId,
      resourceId: contactId,
      outcome: alreadyProcessed ? "already_applied" : "succeeded",
    });
  } catch (error) {
    if (error instanceof ContactDuplicateError) {
      const parsed = parseCreateContactForm(formData);
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

export async function updateContactAction(
  _state: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const request = createMutationRequest("update_contact", "contact");
  const resolved = await mutationContext(request);
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
      if (!verified) {
        return finish(request, invalidConfirmationState(), {
          actorId: actor.userId,
          resourceId: parsed.contactId,
          outcome: "invalid_confirmation",
        });
      }
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
    return finish(request, {
      status: alreadyProcessed ? "already_processed" : "success",
      message: alreadyProcessed
        ? "This confirmed contact update was already applied."
        : "Contact updated successfully.",
      contactId,
      redirectTo: `/contacts/${contactId}`,
    }, {
      actorId: actor.userId,
      resourceId: contactId,
      outcome: alreadyProcessed ? "already_applied" : "succeeded",
    });
  } catch (error) {
    if (error instanceof ContactDuplicateError) {
      const parsed = parseUpdateContactForm(formData);
      return finish(request, duplicateWarningState(error, {
        actorId: actor.userId,
        operation: "update",
        contactId: parsed.contactId,
        submission: parsed.input,
      }), {
        actorId: actor.userId,
        resourceId: parsed.contactId,
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

export async function softDeleteContactAction(
  _state: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const request = createMutationRequest("archive_contact", "contact");
  const resolved = await mutationContext(request);
  if ("state" in resolved) return resolved.state;
  const { actor, service } = resolved.context;

  try {
    const parsed = parseDeleteContactForm(formData);
    await service.softDelete(parsed.contactId, actor);
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${parsed.contactId}`);
    return finish(request, {
      status: "success",
      message: "Contact archived successfully.",
      contactId: parsed.contactId,
      redirectTo: "/contacts",
    }, {
      actorId: actor.userId,
      resourceId: parsed.contactId,
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
