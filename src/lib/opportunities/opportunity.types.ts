import type { LeadActor } from "@/lib/leads/lead.types";

export const opportunityServiceValues = [
  "food_review",
  "hard_selling",
  "corporate",
  "storyline_celebrity",
  "social_media_campaign",
  "event_coverage",
  "other",
] as const;

export type OpportunityService =
  (typeof opportunityServiceValues)[number];

export const opportunityPipelineStageValues = [
  "new",
  "discussion",
  "quotation_sent",
  "negotiation",
  "won",
  "lost",
] as const;

export type OpportunityPipelineStage =
  (typeof opportunityPipelineStageValues)[number];

export const opportunityActivePipelineStageValues = [
  "new",
  "discussion",
  "quotation_sent",
  "negotiation",
] as const;

export type OpportunityActivePipelineStage =
  (typeof opportunityActivePipelineStageValues)[number];

export const opportunityLossReasonValues = [
  "budget",
  "competitor",
  "no_response",
  "postponed",
  "scope_mismatch",
  "client_cancelled",
  "other",
] as const;

export type OpportunityLossReason =
  (typeof opportunityLossReasonValues)[number];

export const opportunityDefaultProbability = {
  new: 20,
  discussion: 40,
  quotation_sent: 60,
  negotiation: 80,
  won: 100,
  lost: 0,
} as const satisfies Record<OpportunityPipelineStage, number>;

export function isTerminalOpportunityStage(
  stage: OpportunityPipelineStage,
): stage is "won" | "lost" {
  return stage === "won" || stage === "lost";
}

export type Opportunity = {
  id: string;
  leadId: string;
  service: OpportunityService;
  estimatedValueMyr: number | null;
  quotationNumber: string | null;
  quotationSentAt: string | null;
  meetingAt: string | null;
  depositAmountMyr: number | null;
  depositReceivedAt: string | null;
  pipelineStage: OpportunityPipelineStage;
  probabilityPercent: number;
  probabilityOverridden: boolean;
  expectedCloseDate: string | null;
  ownerId: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: OpportunityLossReason | null;
  lostReasonNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpportunityRow = {
  id: string;
  lead_id: string;
  service: OpportunityService;
  estimated_value_myr: number | string | null;
  quotation_number: string | null;
  quotation_sent_at: string | null;
  meeting_at: string | null;
  deposit_amount_myr: number | string | null;
  deposit_received_at: string | null;
  pipeline_stage: OpportunityPipelineStage;
  probability_percent: number;
  probability_overridden: boolean;
  expected_close_date: string | null;
  owner_id: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: OpportunityLossReason | null;
  lost_reason_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityPipelineInput = {
  pipelineStage: OpportunityPipelineStage;
  probabilityPercent: number;
  probabilityOverridden?: boolean;
  expectedCloseDate?: string | null;
  ownerId?: string | null;
  lostReason?: OpportunityLossReason | null;
  lostReasonNotes?: string | null;
};

export type ValidatedOpportunityPipelineInput = {
  pipelineStage: OpportunityPipelineStage;
  probabilityPercent: number;
  probabilityOverridden: boolean;
  expectedCloseDate: string | null;
  ownerId: string | null;
  lostReason: OpportunityLossReason | null;
  lostReasonNotes: string | null;
};

export type OpportunityVersionedMutationInput = {
  opportunityId: string;
  expectedUpdatedAt: string;
};

export type OpportunityStageMutationInput =
  OpportunityVersionedMutationInput & {
    pipelineStage: OpportunityActivePipelineStage;
  };

export type OpportunityOwnerMutationInput =
  OpportunityVersionedMutationInput & {
    ownerId: string | null;
  };

export type OpportunityExpectedCloseMutationInput =
  OpportunityVersionedMutationInput & {
    expectedCloseDate: string | null;
  };

export type OpportunityProbabilityMutationInput =
  OpportunityVersionedMutationInput & {
    probabilityPercent: number;
  };

export type OpportunityLostMutationInput =
  OpportunityVersionedMutationInput & {
    lostReason: OpportunityLossReason;
    lostReasonNotes: string | null;
  };

export type OpportunityMutationStatus = "applied" | "already_applied";

export type OpportunityMutationResult = {
  status: OpportunityMutationStatus;
  opportunity: Opportunity;
};

export const opportunityKindValues = [
  "all",
  "conversion",
  "ordinary",
] as const;
export type OpportunityKind = (typeof opportunityKindValues)[number];

export const opportunitySortValues = [
  "newest",
  "oldest",
  "value_desc",
  "value_asc",
] as const;
export type OpportunitySort = (typeof opportunitySortValues)[number];

export type OpportunityListItem = Opportunity & {
  leadTitle: string;
  companyId: string | null;
  companyName: string | null;
  isConversion: boolean;
  convertedAt: string | null;
};

// Detail and list intentionally share the same SECURITY INVOKER projection.
// Keeping this alias explicit documents the detail boundary without duplicating
// a shape that could drift from the authoritative read model.
export type OpportunityDetail = OpportunityListItem;

export type OpportunityListRow = OpportunityRow & {
  lead_title: string;
  company_id: string | null;
  company_name: string | null;
  conversion_opportunity: boolean;
  converted_at: string | null;
};

export type OpportunityListOptions = {
  query?: string;
  service?: OpportunityService;
  kind?: OpportunityKind;
  sort?: OpportunitySort;
  page?: number;
  pageSize?: number;
};

export type ValidatedOpportunityListOptions = {
  query?: string;
  service?: OpportunityService;
  kind: OpportunityKind;
  sort: OpportunitySort;
  page: number;
  pageSize: number;
};

export type PaginatedOpportunities = {
  items: OpportunityListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ConvertLeadInput = {
  leadId: string;
  service?: OpportunityService | null;
  estimatedValueMyr?: number | null;
};

export type ValidatedConvertLeadInput = {
  leadId: string;
  service: OpportunityService | null;
  estimatedValueMyr: number | null;
};

export type LeadConversionStatus = "converted" | "already_converted";

export type LeadConversionResult = {
  leadId: string;
  opportunityId: string;
  status: LeadConversionStatus;
};

export type LeadConversionRecord = {
  leadId: string;
  opportunityId: string;
  convertedAt: string;
  createdBy: string;
  createdAt: string;
};

export type LeadConversionRecordRow = {
  lead_id: string;
  opportunity_id: string;
  converted_at: string;
  created_by: string;
  created_at: string;
};

export type LeadConversionRow = {
  lead_id: string;
  opportunity_id: string;
  conversion_status: LeadConversionStatus;
};

export type LeadConversionActor = LeadActor;
