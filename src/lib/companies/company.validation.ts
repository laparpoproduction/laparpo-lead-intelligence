import { z } from "zod";
import { normalizePublicPhone, normalizeWebsiteDomain } from "./duplicate";
import {
  companySortFields,
  companyTypeValues,
  type CompanyListOptions,
  type CreateCompanyInput,
  type UpdateCompanyInput,
  type ValidatedCompanyListOptions,
  type ValidatedCreateCompanyInput,
} from "./company.types";

const compactText = (value: string) => value.trim().replace(/\s+/g, " ");
const nullableText = z.string().transform(compactText).pipe(z.string().min(1)).nullable().optional();
const url = z.string().trim().pipe(z.url());
const nullableUrl = url.nullable().optional();
const isoDate = z.iso.datetime({ offset: true });
const country = z.string().trim().length(2).transform((value) => value.toUpperCase());

const phone = z
  .string()
  .trim()
  .refine((value) => value.replace(/\D/g, "").length >= 7, "Invalid public phone")
  .nullable()
  .optional();

const companyFields = {
  legalName: z.string().transform(compactText).pipe(z.string().min(2).max(200)),
  displayName: z.string().transform(compactText).pipe(z.string().min(2).max(200)),
  companyType: z.enum(companyTypeValues),
  industry: nullableText,
  description: nullableText,
  publicPhone: phone,
  publicEmail: z.string().trim().toLowerCase().pipe(z.email()).nullable().optional(),
  websiteUrl: nullableUrl,
  facebookUrl: nullableUrl,
  instagramUrl: nullableUrl,
  tiktokUrl: nullableUrl,
  youtubeUrl: nullableUrl,
  googleMapsUrl: nullableUrl,
  addressLine1: nullableText,
  addressLine2: nullableText,
  city: nullableText,
  state: nullableText,
  postcode: z.string().transform(compactText).pipe(z.string().min(1).max(20)).nullable().optional(),
  country,
  estimatedBranchCount: z.number().int().nonnegative().nullable().optional(),
  sourceUrl: url,
  sourceType: z.string().transform(compactText).pipe(z.string().min(1).max(100)),
  discoveredAt: isoDate,
  lastVerifiedAt: isoDate.nullable().optional(),
};

const createCompanySchema = z.object({
  ...companyFields,
  country: companyFields.country.default("MY"),
  discoveredAt: companyFields.discoveredAt.default(() => new Date().toISOString()),
});

const updateCompanySchema = z
  .object(companyFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

const listSchema = z.object({
  query: z.string().trim().min(1).optional(),
  domain: z
    .string()
    .trim()
    .transform((value, context) => {
      const normalized = normalizeWebsiteDomain(value);
      if (!normalized) context.addIssue({ code: "custom", message: "Invalid website domain" });
      return normalized;
    })
    .optional(),
  city: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  industry: z.string().trim().min(1).optional(),
  companyType: z.enum(companyTypeValues).optional(),
  createdBy: z.uuid().optional(),
  includeDeleted: z.boolean().default(false),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
  sortBy: z.enum(companySortFields).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

function normalizePhoneNumber(value: string | null | undefined, countryCode: string) {
  if (value == null) return value;
  const normalized = countryCode === "MY" ? normalizePublicPhone(value) : value.replace(/\D/g, "");
  return normalized || null;
}

export function validateCompanyCreate(input: CreateCompanyInput): ValidatedCreateCompanyInput {
  const parsed = createCompanySchema.parse(input);
  return { ...parsed, publicPhone: normalizePhoneNumber(parsed.publicPhone, parsed.country) };
}

export function validateCompanyUpdate(
  input: UpdateCompanyInput,
  fallbackCountry = "MY",
): UpdateCompanyInput {
  const parsed = updateCompanySchema.parse(input);
  const resolvedCountry = parsed.country ?? fallbackCountry;
  return "publicPhone" in parsed
    ? { ...parsed, publicPhone: normalizePhoneNumber(parsed.publicPhone, resolvedCountry) }
    : parsed;
}

export function validateCompanyListOptions(
  options: CompanyListOptions = {},
): ValidatedCompanyListOptions {
  return listSchema.parse(options) as ValidatedCompanyListOptions;
}

export function validateCompanyId(value: string): string {
  return z.uuid().parse(value);
}

export function validateCompanyFingerprint(value: string): string {
  return z.string().regex(/^[a-f0-9]{32}$/).parse(value);
}
