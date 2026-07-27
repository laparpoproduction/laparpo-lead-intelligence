export const opportunityMutationStatuses = [
  "idle",
  "success",
  "already_applied",
  "validation_error",
  "unauthenticated",
  "inactive",
  "forbidden",
  "not_found",
  "conflict",
  "ineligible",
  "unavailable",
] as const;

export type OpportunityMutationActionState = {
  status: (typeof opportunityMutationStatuses)[number];
  message?: string;
  fieldErrors?: Record<string, string[]>;
  opportunityId?: string;
  updatedAt?: string;
};

export const initialOpportunityMutationActionState: OpportunityMutationActionState =
  {
    status: "idle",
  };
