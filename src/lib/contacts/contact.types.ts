import type { AppRole } from "@/lib/auth/permissions";

export const contactStatusValues = [
  "discovered",
  "verified",
  "contacted",
  "qualified",
  "inactive",
  "do_not_contact",
] as const;
export type ContactStatus = (typeof contactStatusValues)[number];

export type Contact = {
  id: string;
  companyId: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  department: string | null;
  seniority: string | null;
  workEmail: string | null;
  personalEmail: string | null;
  publicPhone: string | null;
  mobilePhone: string | null;
  whatsappPhone: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  sourceUrl: string;
  sourceType: string;
  discoveredAt: string;
  lastVerifiedAt: string | null;
  isPrimaryContact: boolean;
  contactStatus: ContactStatus;
  notes: string | null;
  createdBy: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  fingerprint: string | null;
};

export type ContactRow = {
  id: string;
  company_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  department: string | null;
  seniority: string | null;
  work_email: string | null;
  personal_email: string | null;
  public_phone: string | null;
  mobile_phone: string | null;
  whatsapp_phone: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  source_url: string;
  source_type: string;
  discovered_at: string;
  last_verified_at: string | null;
  is_primary_contact: boolean;
  contact_status: ContactStatus;
  notes: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  fingerprint: string | null;
};

export type CreateContactInput = {
  companyId?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  seniority?: string | null;
  workEmail?: string | null;
  personalEmail?: string | null;
  publicPhone?: string | null;
  mobilePhone?: string | null;
  whatsappPhone?: string | null;
  linkedinUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  sourceUrl: string;
  sourceType: string;
  discoveredAt: string;
  lastVerifiedAt?: string | null;
  isPrimaryContact?: boolean;
  contactStatus?: ContactStatus;
  notes?: string | null;
  assignedTo?: string | null;
};

export type ValidatedCreateContactInput = CreateContactInput & {
  isPrimaryContact: boolean;
  contactStatus: ContactStatus;
};

export type UpdateContactInput = Partial<CreateContactInput>;

export type ContactInsert = Omit<
  ContactRow,
  "id" | "created_at" | "updated_at" | "deleted_at" | "fingerprint"
>;

export type ContactUpdate = Partial<
  Omit<ContactInsert, "created_by">
>;

export const contactSortFields = [
  "fullName",
  "jobTitle",
  "department",
  "contactStatus",
  "createdAt",
  "updatedAt",
  "lastVerifiedAt",
] as const;
export type ContactSortField = (typeof contactSortFields)[number];
export type ContactSortDirection = "asc" | "desc";

export type ContactListOptions = {
  query?: string;
  companyId?: string;
  assignedTo?: string;
  createdBy?: string;
  contactStatus?: ContactStatus;
  isPrimaryContact?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: ContactSortField;
  sortDirection?: ContactSortDirection;
};

export type ValidatedContactListOptions = Required<
  Pick<ContactListOptions, "page" | "pageSize" | "sortBy" | "sortDirection">
> &
  Omit<ContactListOptions, "page" | "pageSize" | "sortBy" | "sortDirection">;

export type PaginatedContacts = {
  items: Contact[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ContactActor = {
  userId: string;
  role: AppRole;
  isActive: boolean;
};

export type ContactDuplicateCandidate = Pick<
  Contact,
  | "id"
  | "companyId"
  | "fullName"
  | "workEmail"
  | "personalEmail"
  | "publicPhone"
  | "mobilePhone"
  | "whatsappPhone"
  | "linkedinUrl"
>;
