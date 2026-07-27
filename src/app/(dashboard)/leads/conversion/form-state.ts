export const leadConversionStatuses = [
  "idle",
  "success",
  "already_converted",
  "validation_error",
  "unauthenticated",
  "inactive",
  "forbidden",
  "not_found",
  "ineligible",
  "legacy_unresolved",
  "unavailable",
] as const;

export type LeadConversionActionState = {
  status: (typeof leadConversionStatuses)[number];
  message?: string;
  fieldErrors?: Record<string, string[]>;
  leadId?: string;
  opportunityId?: string;
};

export const initialLeadConversionActionState: LeadConversionActionState = {
  status: "idle",
};
