import type { AppRole } from "@/lib/auth/permissions";

export const leadStageValues = [
  "new",
  "researching",
  "ready_to_contact",
  "contacted",
  "replied",
  "qualified",
  "meeting_scheduled",
  "quotation_requested",
  "quotation_sent",
  "negotiation",
  "converted",
  "lost",
  "disqualified",
] as const;
export type LeadStage = (typeof leadStageValues)[number];

export const leadStatusValues = ["active", "paused", "closed"] as const;
export type LeadStatus = (typeof leadStatusValues)[number];

export const leadQualificationValues = [
  "unreviewed",
  "researching",
  "potentially_qualified",
  "qualified",
  "unqualified",
] as const;
export type LeadQualificationStatus = (typeof leadQualificationValues)[number];

export const leadPriorityValues = ["low", "normal", "high", "urgent"] as const;
export type LeadPriority = (typeof leadPriorityValues)[number];

export const leadServiceInterestValues = [
  "food_review",
  "hard_selling_video",
  "corporate_video",
  "storyline_celebrity",
  "social_media_campaign",
  "event_coverage",
  "other",
] as const;
export type LeadServiceInterest = (typeof leadServiceInterestValues)[number];

export const leadSourceTypeValues = [
  "manual",
  "company_website",
  "social_media",
  "referral",
  "inbound",
  "event",
  "campaign",
  "public_directory",
  "signal",
  "other",
] as const;
export type LeadSourceType = (typeof leadSourceTypeValues)[number];

export type Lead = {
  id: string;
  companyId: string | null;
  primaryContactId: string | null;
  title: string;
  stage: LeadStage;
  leadStatus: LeadStatus;
  qualificationStatus: LeadQualificationStatus;
  priority: LeadPriority;
  leadScore: number | null;
  estimatedValue: number | null;
  currency: string;
  serviceInterest: LeadServiceInterest | null;
  assignedTo: string | null;
  createdBy: string | null;
  sourceType: LeadSourceType;
  sourceUrl: string | null;
  sourceSignalId: string | null;
  sourceCampaign: string | null;
  referralName: string | null;
  discoveredAt: string;
  lastVerifiedAt: string | null;
  businessNeed: string | null;
  budgetNotes: string | null;
  timelineNotes: string | null;
  decisionMakerNotes: string | null;
  expectedCloseDate: string | null;
  nextStep: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  notes: string | null;
  convertedAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  disqualifiedAt: string | null;
  disqualifiedReason: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  fingerprint: string | null;
};

export type LeadRow = {
  id: string;
  company_id: string | null;
  primary_contact_id: string | null;
  title: string;
  stage: LeadStage;
  lead_status: LeadStatus;
  qualification_status: LeadQualificationStatus;
  priority: LeadPriority;
  lead_score: number | null;
  estimated_value: number | null;
  currency: string;
  service_interest: string | null;
  assigned_to: string | null;
  created_by: string | null;
  source_type: LeadSourceType;
  source_url: string | null;
  source_signal_id: string | null;
  source_campaign: string | null;
  referral_name: string | null;
  discovered_at: string;
  last_verified_at: string | null;
  business_need: string | null;
  budget_notes: string | null;
  timeline_notes: string | null;
  decision_maker_notes: string | null;
  expected_close_date: string | null;
  next_step: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  converted_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  disqualified_at: string | null;
  disqualified_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  fingerprint: string | null;
};

export type CreateLeadInput = {
  companyId?: string | null;
  primaryContactId?: string | null;
  title: string;
  stage?: LeadStage;
  leadStatus?: LeadStatus;
  qualificationStatus?: LeadQualificationStatus;
  priority?: LeadPriority;
  leadScore?: number | null;
  estimatedValue?: number | null;
  currency?: string;
  serviceInterest?: LeadServiceInterest | null;
  assignedTo?: string | null;
  sourceType: LeadSourceType;
  sourceUrl?: string | null;
  sourceSignalId?: string | null;
  sourceCampaign?: string | null;
  referralName?: string | null;
  discoveredAt: string;
  lastVerifiedAt?: string | null;
  businessNeed?: string | null;
  budgetNotes?: string | null;
  timelineNotes?: string | null;
  decisionMakerNotes?: string | null;
  expectedCloseDate?: string | null;
  nextStep?: string | null;
  nextFollowUpAt?: string | null;
  lastContactedAt?: string | null;
  notes?: string | null;
  convertedAt?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
  disqualifiedAt?: string | null;
  disqualifiedReason?: string | null;
};

export type ValidatedCreateLeadInput = Omit<CreateLeadInput, "discoveredAt" | "currency"> & {
  discoveredAt: string;
  currency: string;
  stage: LeadStage;
  leadStatus: LeadStatus;
  qualificationStatus: LeadQualificationStatus;
  priority: LeadPriority;
};

export type UpdateLeadInput = Partial<Omit<CreateLeadInput, "discoveredAt">> & {
  discoveredAt?: string;
};

export type LeadInsert = Omit<LeadRow, "id" | "created_at" | "updated_at" | "deleted_at" | "fingerprint">;
export type LeadUpdate = Partial<Omit<LeadInsert, "created_by" | "discovered_at">> & {
  discovered_at?: string;
};

export const leadSortFields = [
  "title",
  "stage",
  "leadStatus",
  "qualificationStatus",
  "priority",
  "createdAt",
  "updatedAt",
  "nextFollowUpAt",
  "expectedCloseDate",
] as const;
export type LeadSortField = (typeof leadSortFields)[number];
export type SortDirection = "asc" | "desc";

export type LeadFilters = {
  query?: string;
  companyId?: string;
  assignedTo?: string;
  createdBy?: string;
  stage?: LeadStage;
  leadStatus?: LeadStatus;
  qualificationStatus?: LeadQualificationStatus;
  priority?: LeadPriority;
  includeDeleted?: boolean;
};

export type LeadLookupOptions = {
  includeDeleted?: boolean;
};

export type LeadListOptions = LeadFilters & {
  page?: number;
  pageSize?: number;
  sortBy?: LeadSortField;
  sortDirection?: SortDirection;
};

export type ValidatedLeadListOptions = Required<
  Pick<LeadListOptions, "page" | "pageSize" | "sortBy" | "sortDirection" | "includeDeleted">
> &
  Omit<LeadListOptions, "page" | "pageSize" | "sortBy" | "sortDirection" | "includeDeleted">;

export type PaginatedLeads = {
  items: Lead[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type LeadActor = {
  userId: string;
  role: AppRole;
  isActive: boolean;
};

export type LeadConfirmationContext = {
  confirmationId: string;
  submissionHash: string;
  actorId: string;
  operation: "create" | "update";
  leadId?: string;
};

export type ConfirmedLeadMutationResult = {
  status: "applied" | "already_processed";
  leadId: string;
};

export type LeadDuplicateCandidate = Pick<
  Lead,
  | "id"
  | "companyId"
  | "primaryContactId"
  | "title"
  | "serviceInterest"
  | "sourceUrl"
  | "sourceCampaign"
  | "sourceSignalId"
>;
