import type { AppRole } from "@/lib/auth/permissions";

export const companyTypeValues = ["fnb", "agency", "hotel", "other"] as const;
export type CompanyType = (typeof companyTypeValues)[number];

export type Company = {
  id: string;
  legalName: string;
  displayName: string;
  companyType: CompanyType;
  industry: string | null;
  description: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  websiteUrl: string | null;
  websiteDomain: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  googleMapsUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string;
  estimatedBranchCount: number | null;
  sourceUrl: string;
  sourceType: string;
  discoveredAt: string;
  lastVerifiedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  fingerprint: string;
  deletedAt: string | null;
};

export type CompanyRow = {
  id: string;
  legal_name: string;
  display_name: string;
  company_type: CompanyType;
  industry: string | null;
  description: string | null;
  public_phone: string | null;
  public_email: string | null;
  website_url: string | null;
  website_domain: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  google_maps_url: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string;
  estimated_branch_count: number | null;
  source_url: string;
  source_type: string;
  discovered_at: string;
  last_verified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  fingerprint: string;
  deleted_at: string | null;
};

export type CreateCompanyInput = {
  legalName: string;
  displayName: string;
  companyType: CompanyType;
  industry?: string | null;
  description?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
  googleMapsUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string;
  estimatedBranchCount?: number | null;
  sourceUrl: string;
  sourceType: string;
  discoveredAt?: string;
  lastVerifiedAt?: string | null;
};

export type ValidatedCreateCompanyInput = Omit<
  CreateCompanyInput,
  "discoveredAt" | "country"
> & {
  country: string;
  discoveredAt: string;
};

export type UpdateCompanyInput = Partial<Omit<CreateCompanyInput, "discoveredAt">> & {
  discoveredAt?: string;
  lastVerifiedAt?: string | null;
};

export type CompanyInsert = Omit<
  CompanyRow,
  "id" | "fingerprint" | "created_at" | "updated_at" | "deleted_at"
>;

export type CompanyUpdate = Partial<
  Omit<CompanyInsert, "created_by" | "discovered_at">
> & {
  discovered_at?: string;
};

export const companySortFields = [
  "displayName",
  "legalName",
  "industry",
  "city",
  "state",
  "createdAt",
  "updatedAt",
] as const;
export type CompanySortField = (typeof companySortFields)[number];
export type SortDirection = "asc" | "desc";

export type CompanyFilters = {
  query?: string;
  domain?: string;
  city?: string;
  state?: string;
  industry?: string;
  companyType?: CompanyType;
  createdBy?: string;
  includeDeleted?: boolean;
};

export type CompanyListOptions = CompanyFilters & {
  page?: number;
  pageSize?: number;
  sortBy?: CompanySortField;
  sortDirection?: SortDirection;
};

export type ValidatedCompanyListOptions = Required<
  Pick<CompanyListOptions, "page" | "pageSize" | "sortBy" | "sortDirection" | "includeDeleted">
> &
  Omit<CompanyListOptions, "page" | "pageSize" | "sortBy" | "sortDirection" | "includeDeleted">;

export type PaginatedCompanies = {
  items: Company[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CompanyActor = {
  userId: string;
  role: AppRole;
  isActive: boolean;
};
