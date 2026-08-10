import type {
  LeadPriority,
  LeadQualificationStatus,
  LeadServiceInterest,
  LeadStage,
  LeadStatus,
} from "./lead.types";

export const LEAD_FOLLOW_UP_CANDIDATE_LIMIT = 50;
export const LEAD_FOLLOW_UP_CATEGORY_LIMIT = 6;
export const LEAD_FOLLOW_UP_DISPLAY_CATEGORY_LIMIT = 3;
export const LEAD_FOLLOW_UP_DISPLAY_LEAD_LIMIT = 5;

export const leadFollowUpAttentionCodes = [
  "overdue_follow_up",
  "expected_close_passed",
  "replied_needs_review",
  "ready_to_contact_without_contact_record",
  "qualified_needs_progress",
  "missing_follow_up",
  "unassigned_active",
] as const;

export type LeadFollowUpAttentionCode =
  (typeof leadFollowUpAttentionCodes)[number];

export const leadFollowUpEligibleStages = [
  "new",
  "researching",
  "ready_to_contact",
  "contacted",
  "replied",
  "qualified",
  "meeting_scheduled",
  "quotation_requested",
] as const satisfies readonly LeadStage[];

export type LeadFollowUpReadRow = {
  id: string;
  title: string;
  stage: LeadStage;
  lead_status: LeadStatus;
  qualification_status: LeadQualificationStatus;
  priority: LeadPriority;
  service_interest: LeadServiceInterest | null;
  assigned_to: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  expected_close_date: string | null;
  updated_at: string;
};

export type LeadFollowUpPriorityReadModel = {
  candidates: LeadFollowUpReadRow[];
  eligibleAccessibleLeadCount: number;
  configuredAttentionLeadCount: number;
  authoritativeNow: string;
  authoritativeUtcDate: string;
};

export type LeadFollowUpOverview =
  | "no_eligible_leads"
  | "limited_lead_data"
  | "no_configured_attention"
  | "lead_attention_available";

export type LeadFollowUpDisplayLead = {
  leadId: string;
  title: string;
  stage: LeadStage;
  priority: LeadPriority;
  serviceInterest: LeadServiceInterest | null;
  nextFollowUpAt: string | null;
  expectedCloseDate: string | null;
};

export type LeadFollowUpDisplayGroup = {
  code: LeadFollowUpAttentionCode;
  heading: string;
  reason: string;
  action: string;
  leads: LeadFollowUpDisplayLead[];
};

export type RenderedLeadFollowUpQueue = {
  overview: LeadFollowUpOverview;
  overviewText: string;
  eligibleAccessibleLeadCount: number;
  configuredAttentionLeadCount: number;
  analyzedCandidateCount: number;
  candidateLimit: number;
  groups: LeadFollowUpDisplayGroup[];
};
