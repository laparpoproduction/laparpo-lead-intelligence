export const leadActivityFormStatuses = [
  "idle",
  "validation_error",
  "permission_error",
  "not_found",
  "error",
  "success",
] as const;

export type LeadActivityFormStatus =
  (typeof leadActivityFormStatuses)[number];

export type LeadActivityFormState = {
  status: LeadActivityFormStatus;
  code?:
    | "unauthenticated"
    | "inactive"
    | "forbidden"
    | "not_found"
    | "unexpected";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  activityId?: string;
  leadId?: string;
};

export const initialLeadActivityFormState: LeadActivityFormState = {
  status: "idle",
};
