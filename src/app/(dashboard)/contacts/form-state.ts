export const contactFormStatuses = [
  "idle",
  "validation_error",
  "duplicate_warning",
  "permission_error",
  "not_found",
  "error",
  "success",
  "already_processed",
] as const;

export type ContactFormStatus = (typeof contactFormStatuses)[number];

export type ContactFormState = {
  status: ContactFormStatus;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  duplicateCandidateIds?: string[];
  confirmationToken?: string;
  contactId?: string;
  redirectTo?: string;
};

export const initialContactFormState: ContactFormState = { status: "idle" };
