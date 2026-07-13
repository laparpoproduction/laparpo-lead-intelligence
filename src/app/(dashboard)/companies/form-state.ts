export const companyFormStatuses = [
  "idle",
  "validation_error",
  "duplicate_warning",
  "permission_error",
  "not_found",
  "error",
  "success",
] as const;

export type CompanyFormStatus = (typeof companyFormStatuses)[number];

export type CompanyFormState = {
  status: CompanyFormStatus;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  duplicateCandidateIds?: string[];
  confirmationToken?: string;
  companyId?: string;
  redirectTo?: string;
};

export const initialCompanyFormState: CompanyFormState = { status: "idle" };
