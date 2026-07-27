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
  created_at: string;
  updated_at: string;
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
