export const leadFormStatuses = [
  "idle",
  "validation_error",
  "duplicate_warning",
  "permission_error",
  "not_found",
  "error",
  "success",
] as const;

export type LeadFormStatus = (typeof leadFormStatuses)[number];

export type LeadFormState = {
  status: LeadFormStatus;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  duplicateCandidateIds?: string[];
  confirmationToken?: string;
  leadId?: string;
  redirectTo?: string;
};

export const initialLeadFormState: LeadFormState = { status: "idle" };
