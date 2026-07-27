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
