import { z } from "zod";
import { companyTypeValues, type CreateCompanyInput, type UpdateCompanyInput } from "./company.types";

const optionalNullableString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const optionalBranchCount = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") return null;
  if (typeof value !== "string") return value;
  if (!/^\d+$/.test(value.trim())) return Number.NaN;
  return Number(value);
}, z.number().int().nonnegative().nullable().optional());

const optionalTimestamp = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.iso.datetime({ offset: true }).optional(),
);

const optionalNullableTimestamp = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.iso.datetime({ offset: true }).nullable().optional(),
);

const companyFormFields = {
  legalName: z.string().trim().min(1, "Legal name is required"),
  displayName: z.string().trim().min(1, "Display name is required"),
  companyType: z.enum(companyTypeValues, { error: "Select a company type" }),
  industry: optionalNullableString,
  description: optionalNullableString,
  publicPhone: optionalNullableString,
  publicEmail: optionalNullableString,
  websiteUrl: optionalNullableString,
  facebookUrl: optionalNullableString,
  instagramUrl: optionalNullableString,
  tiktokUrl: optionalNullableString,
  youtubeUrl: optionalNullableString,
  googleMapsUrl: optionalNullableString,
  addressLine1: optionalNullableString,
  addressLine2: optionalNullableString,
  city: optionalNullableString,
  state: optionalNullableString,
  postcode: optionalNullableString,
  country: optionalString,
  estimatedBranchCount: optionalBranchCount,
  sourceUrl: z.string().trim().min(1, "Source URL is required"),
  sourceType: z.string().trim().min(1, "Source type is required"),
  discoveredAt: optionalTimestamp,
  lastVerifiedAt: optionalNullableTimestamp,
};

export const createCompanyFormSchema = z.object(companyFormFields);

export const updateCompanyFormSchema = z
  .object(companyFormFields)
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one company field is required",
  });

export const deleteCompanyFormSchema = z.object({
  companyId: z.uuid("Invalid company ID"),
  confirm: z.preprocess(
    (value) => value === true || value === "true" || value === "on" || value === "1",
    z.literal(true, { error: "Confirm company deletion" }),
  ),
});

const companyFieldNames = Object.keys(companyFormFields) as Array<keyof typeof companyFormFields>;

function formDataValue(formData: FormData, field: string): FormDataEntryValue | undefined {
  const value = formData.get(field);
  return value === null ? undefined : value;
}

function companyFormRecord(formData: FormData, includeMissing: boolean): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const field of companyFieldNames) {
    const value = formDataValue(formData, field);
    if (includeMissing || value !== undefined) record[field] = value;
  }
  return record;
}

export type ParsedCompanyCreateForm = {
  input: CreateCompanyInput;
  confirmationToken?: string;
};

export type ParsedCompanyUpdateForm = {
  companyId: string;
  input: UpdateCompanyInput;
  confirmationToken?: string;
};

export function parseCreateCompanyForm(formData: FormData): ParsedCompanyCreateForm {
  return {
    input: createCompanyFormSchema.parse(companyFormRecord(formData, true)),
    confirmationToken: optionalString.parse(formDataValue(formData, "confirmationToken")),
  };
}

export function parseUpdateCompanyForm(formData: FormData): ParsedCompanyUpdateForm {
  return {
    companyId: z.uuid("Invalid company ID").parse(formDataValue(formData, "companyId")),
    input: updateCompanyFormSchema.parse(companyFormRecord(formData, false)),
    confirmationToken: optionalString.parse(formDataValue(formData, "confirmationToken")),
  };
}

export function parseDeleteCompanyForm(formData: FormData) {
  return deleteCompanyFormSchema.parse({
    companyId: formDataValue(formData, "companyId"),
    confirm: formDataValue(formData, "confirm"),
  });
}
