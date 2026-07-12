import { normalizeWebsiteDomain } from "./duplicate";
import type {
  Company,
  CompanyInsert,
  CompanyRow,
  CompanyUpdate,
  UpdateCompanyInput,
  ValidatedCreateCompanyInput,
} from "./company.types";

export function mapCompanyRow(row: CompanyRow): Company {
  return {
    id: row.id,
    legalName: row.legal_name,
    displayName: row.display_name,
    companyType: row.company_type,
    industry: row.industry,
    description: row.description,
    publicPhone: row.public_phone,
    publicEmail: row.public_email,
    websiteUrl: row.website_url,
    websiteDomain: row.website_domain,
    facebookUrl: row.facebook_url,
    instagramUrl: row.instagram_url,
    tiktokUrl: row.tiktok_url,
    youtubeUrl: row.youtube_url,
    googleMapsUrl: row.google_maps_url,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    city: row.city,
    state: row.state,
    postcode: row.postcode,
    country: row.country,
    estimatedBranchCount: row.estimated_branch_count,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    discoveredAt: row.discovered_at,
    lastVerifiedAt: row.last_verified_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fingerprint: row.fingerprint,
    deletedAt: row.deleted_at,
  };
}

export function mapCompanyCreate(
  input: ValidatedCreateCompanyInput,
  createdBy: string,
): CompanyInsert {
  return {
    legal_name: input.legalName,
    display_name: input.displayName,
    company_type: input.companyType,
    industry: input.industry ?? null,
    description: input.description ?? null,
    public_phone: input.publicPhone ?? null,
    public_email: input.publicEmail ?? null,
    website_url: input.websiteUrl ?? null,
    website_domain: normalizeWebsiteDomain(input.websiteUrl) || null,
    facebook_url: input.facebookUrl ?? null,
    instagram_url: input.instagramUrl ?? null,
    tiktok_url: input.tiktokUrl ?? null,
    youtube_url: input.youtubeUrl ?? null,
    google_maps_url: input.googleMapsUrl ?? null,
    address_line_1: input.addressLine1 ?? null,
    address_line_2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postcode: input.postcode ?? null,
    country: input.country,
    estimated_branch_count: input.estimatedBranchCount ?? null,
    source_url: input.sourceUrl,
    source_type: input.sourceType,
    discovered_at: input.discoveredAt,
    last_verified_at: input.lastVerifiedAt ?? null,
    created_by: createdBy,
  };
}

const updateFieldMap = {
  legalName: "legal_name",
  displayName: "display_name",
  companyType: "company_type",
  industry: "industry",
  description: "description",
  publicPhone: "public_phone",
  publicEmail: "public_email",
  facebookUrl: "facebook_url",
  instagramUrl: "instagram_url",
  tiktokUrl: "tiktok_url",
  youtubeUrl: "youtube_url",
  googleMapsUrl: "google_maps_url",
  addressLine1: "address_line_1",
  addressLine2: "address_line_2",
  city: "city",
  state: "state",
  postcode: "postcode",
  country: "country",
  estimatedBranchCount: "estimated_branch_count",
  sourceUrl: "source_url",
  sourceType: "source_type",
  discoveredAt: "discovered_at",
  lastVerifiedAt: "last_verified_at",
} as const;

export function mapCompanyUpdate(input: UpdateCompanyInput): CompanyUpdate {
  const output: CompanyUpdate = {};

  for (const [source, target] of Object.entries(updateFieldMap) as Array<
    [keyof typeof updateFieldMap, (typeof updateFieldMap)[keyof typeof updateFieldMap]]
  >) {
    if (source in input) {
      (output as Record<string, unknown>)[target] = input[source] ?? null;
    }
  }

  if ("websiteUrl" in input) {
    output.website_url = input.websiteUrl ?? null;
    output.website_domain = normalizeWebsiteDomain(input.websiteUrl) || null;
  }

  return output;
}
