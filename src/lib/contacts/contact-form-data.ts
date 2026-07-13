import { z } from "zod";
import { contactStatusValues } from "./contact.types";
import type { CreateContactInput, UpdateContactInput } from "./contact.types";
import { validateContactCreate, validateContactUpdate } from "./contact.validation";

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalNullableString = z.preprocess(
  emptyToNull,
  z.string().trim().nullable().optional(),
);
const optionalNullableUuid = z.preprocess(
  emptyToNull,
  z.uuid("Invalid ID").nullable().optional(),
);
const optionalTimestamp = z.preprocess(
  emptyToUndefined,
  z.iso.datetime({ offset: true }).optional(),
);
const optionalNullableTimestamp = z.preprocess(
  emptyToNull,
  z.iso.datetime({ offset: true }).nullable().optional(),
);
const optionalBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true" || value === "on" || value === "1") return true;
  if (value === false || value === "false" || value === "off" || value === "0") return false;
  return value;
}, z.boolean().optional());
const optionalToken = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const contactFormFields = {
  companyId: optionalNullableUuid,
  fullName: optionalNullableString,
  firstName: optionalNullableString,
  lastName: optionalNullableString,
  jobTitle: optionalNullableString,
  department: optionalNullableString,
  seniority: optionalNullableString,
  workEmail: optionalNullableString,
  personalEmail: optionalNullableString,
  publicPhone: optionalNullableString,
  mobilePhone: optionalNullableString,
  whatsappPhone: optionalNullableString,
  linkedinUrl: optionalNullableString,
  facebookUrl: optionalNullableString,
  instagramUrl: optionalNullableString,
  sourceUrl: optionalNullableString,
  sourceType: optionalNullableString,
  discoveredAt: optionalTimestamp,
  lastVerifiedAt: optionalNullableTimestamp,
  isPrimaryContact: optionalBoolean,
  contactStatus: z.enum(contactStatusValues).optional(),
  notes: optionalNullableString,
  assignedTo: optionalNullableUuid,
};

const rawCreateSchema = z.object(contactFormFields);
const rawUpdateSchema = z.object(contactFormFields).partial();

const contactFieldNames = Object.keys(contactFormFields) as Array<
  keyof typeof contactFormFields
>;

function formDataValue(
  formData: FormData,
  field: string,
): FormDataEntryValue | undefined {
  const value = formData.get(field);
  return value === null ? undefined : value;
}

function contactFormRecord(
  formData: FormData,
  includeMissing: boolean,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const field of contactFieldNames) {
    const value = formDataValue(formData, field);
    if (includeMissing || value !== undefined) record[field] = value;
  }
  return record;
}

export type ParsedContactCreateForm = {
  input: CreateContactInput;
  confirmationToken?: string;
};

export type ParsedContactUpdateForm = {
  contactId: string;
  input: UpdateContactInput;
  confirmationToken?: string;
};

export function parseCreateContactForm(formData: FormData): ParsedContactCreateForm {
  const raw = rawCreateSchema.parse(contactFormRecord(formData, true));
  return {
    input: validateContactCreate(raw as CreateContactInput),
    confirmationToken: optionalToken.parse(
      formDataValue(formData, "confirmationToken"),
    ),
  };
}

export function parseUpdateContactForm(formData: FormData): ParsedContactUpdateForm {
  const raw = rawUpdateSchema.parse(contactFormRecord(formData, false));
  return {
    contactId: z.uuid("Invalid contact ID").parse(
      formDataValue(formData, "contactId"),
    ),
    input: validateContactUpdate(raw as UpdateContactInput),
    confirmationToken: optionalToken.parse(
      formDataValue(formData, "confirmationToken"),
    ),
  };
}

export function parseDeleteContactForm(formData: FormData): {
  contactId: string;
  confirm: true;
} {
  return z.object({
    contactId: z.uuid("Invalid contact ID"),
    confirm: z.preprocess(
      (value) => value === true || value === "true" || value === "on" || value === "1",
      z.literal(true, { error: "Confirm contact deletion" }),
    ),
  }).parse({
    contactId: formDataValue(formData, "contactId"),
    confirm: formDataValue(formData, "confirm"),
  });
}
