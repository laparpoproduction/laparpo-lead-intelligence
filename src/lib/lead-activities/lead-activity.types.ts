import type { AppRole } from "@/lib/auth/permissions";

export const leadActivityTypeValues = [
  "call",
  "meeting",
  "note",
  "email",
  "whatsapp",
  "follow_up",
  "quotation",
  "deposit",
  "status_change",
] as const;

export type LeadActivityType = (typeof leadActivityTypeValues)[number];

export type LeadActivity = {
  id: string;
  leadId: string;
  activityType: LeadActivityType;
  subject: string | null;
  description: string | null;
  activityAt: string;
  nextFollowUpAt: string | null;
  outcome: string | null;
  createdBy: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type LeadActivityRow = {
  id: string;
  lead_id: string;
  activity_type: LeadActivityType;
  subject: string | null;
  description: string | null;
  activity_at: string;
  next_follow_up_at: string | null;
  outcome: string | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LeadActivityCreateInput = {
  leadId: string;
  activityType: LeadActivityType;
  subject?: string | null;
  description?: string | null;
  activityAt?: string;
  nextFollowUpAt?: string | null;
  outcome?: string | null;
  assignedTo?: string | null;
};

export type ValidatedLeadActivityCreateInput = Omit<
  LeadActivityCreateInput,
  "activityAt"
> & {
  activityAt: string;
};

export type LeadActivityUpdateInput = Partial<
  Omit<LeadActivityCreateInput, "leadId">
>;

export type LeadActivityInsert = Omit<
  LeadActivityRow,
  "id" | "created_at" | "updated_at" | "deleted_at"
>;

export type LeadActivityUpdate = Partial<
  Omit<LeadActivityInsert, "lead_id" | "created_by">
>;

export type LeadActivityListOptions = {
  activityType?: LeadActivityType;
  assignedTo?: string;
  fromActivityAt?: string;
  toActivityAt?: string;
  page?: number;
  pageSize?: number;
  sortDirection?: "asc" | "desc";
};

export type ValidatedLeadActivityListOptions = Required<
  Pick<LeadActivityListOptions, "page" | "pageSize" | "sortDirection">
> &
  Omit<LeadActivityListOptions, "page" | "pageSize" | "sortDirection">;

export type PaginatedLeadActivities = {
  items: LeadActivity[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type LeadActivityActor = {
  userId: string;
  role: AppRole;
  isActive: boolean;
};
