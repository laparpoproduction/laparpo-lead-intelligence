import { z } from "zod";
import {
  normalizeContactEmail,
  normalizeContactName,
  normalizeContactPhone,
  normalizeContactProfileUrl,
} from "./contact-normalization";
import {
  contactSortFields,
  contactStatusValues,
  type Contact,
  type ContactListOptions,
  type CreateContactInput,
  type UpdateContactInput,
  type ValidatedContactListOptions,
  type ValidatedCreateContactInput,
} from "./contact.types";

export const CONTACTS_DEFAULT_PAGE_SIZE = 25;
export const CONTACTS_MAX_PAGE_SIZE = 100;

const compactText = (value: string) => normalizeContactName(value);
const optionalText = (maximum: number) =>
  z.string().transform(compactText).pipe(z.string().min(1).max(maximum)).nullable().optional();
const optionalUuid = z.uuid().nullable().optional();
const timestamp = z.iso.datetime({ offset: true });
const sourceUrl = z.string().trim().pipe(z.url({ protocol: /^https?$/ }));

const optionalEmail = z
  .string()
  .transform(normalizeContactEmail)
  .pipe(z.email())
  .nullable()
  .optional();

const optionalPhone = z
  .string()
  .transform((value, context) => {
    const normalized = normalizeContactPhone(value);
    if (!/^\d{7,15}$/.test(normalized)) {
      context.addIssue({ code: "custom", message: "Invalid phone number" });
      return z.NEVER;
    }
    return normalized;
  })
  .nullable()
  .optional();

function optionalProfileUrl(hostname: string) {
  return z
    .string()
    .transform((value, context) => {
      const normalized = normalizeContactProfileUrl(value);
      if (!normalized) {
        context.addIssue({ code: "custom", message: "Invalid public profile URL" });
        return z.NEVER;
      }
      const host = new URL(normalized).hostname;
      if (host !== hostname && !host.endsWith(`.${hostname}`)) {
        context.addIssue({ code: "custom", message: `Expected a ${hostname} URL` });
        return z.NEVER;
      }
      return normalized;
    })
    .nullable()
    .optional();
}

const contactFields = {
  companyId: optionalUuid,
  fullName: optionalText(200),
  firstName: optionalText(120),
  lastName: optionalText(120),
  jobTitle: optionalText(160),
  department: optionalText(160),
  seniority: optionalText(80),
  workEmail: optionalEmail,
  personalEmail: optionalEmail,
  publicPhone: optionalPhone,
  mobilePhone: optionalPhone,
  whatsappPhone: optionalPhone,
  linkedinUrl: optionalProfileUrl("linkedin.com"),
  facebookUrl: optionalProfileUrl("facebook.com"),
  instagramUrl: optionalProfileUrl("instagram.com"),
  sourceUrl,
  sourceType: z.string().transform(compactText).pipe(z.string().min(1).max(100)),
  discoveredAt: timestamp,
  lastVerifiedAt: timestamp.nullable().optional(),
  isPrimaryContact: z.boolean(),
  contactStatus: z.enum(contactStatusValues),
  notes: optionalText(5000),
  assignedTo: optionalUuid,
};

function hasIdentity(value: Partial<CreateContactInput>): boolean {
  return [
    value.fullName,
    value.firstName,
    value.lastName,
    value.workEmail,
    value.personalEmail,
    value.publicPhone,
    value.mobilePhone,
    value.whatsappPhone,
    value.linkedinUrl,
  ].some(Boolean);
}

const createContactSchema = z
  .object({
    ...contactFields,
    isPrimaryContact: contactFields.isPrimaryContact.default(false),
    contactStatus: contactFields.contactStatus.default("discovered"),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasIdentity(value)) {
      context.addIssue({
        code: "custom",
        path: ["fullName"],
        message: "At least one meaningful contact identity field is required",
      });
    }
    if (value.lastVerifiedAt && value.lastVerifiedAt < value.discoveredAt) {
      context.addIssue({
        code: "custom",
        path: ["lastVerifiedAt"],
        message: "Verification cannot precede discovery",
      });
    }
  })
  .transform((value) => {
    if (value.fullName || (!value.firstName && !value.lastName)) return value;
    return {
      ...value,
      fullName: normalizeContactName([value.firstName, value.lastName].filter(Boolean).join(" ")),
    };
  });

const updateContactSchema = z
  .object(contactFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

const listSchema = z
  .object({
    query: z.string().trim().min(1).optional(),
    companyId: z.uuid().optional(),
    assignedTo: z.uuid().optional(),
    createdBy: z.uuid().optional(),
    contactStatus: z.enum(contactStatusValues).optional(),
    isPrimaryContact: z.boolean().optional(),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(CONTACTS_MAX_PAGE_SIZE).default(CONTACTS_DEFAULT_PAGE_SIZE),
    sortBy: z.enum(contactSortFields).default("createdAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export function validateContactCreate(input: CreateContactInput): ValidatedCreateContactInput {
  return createContactSchema.parse(input) as ValidatedCreateContactInput;
}

export function validateContactUpdate(
  input: UpdateContactInput,
  current?: Contact,
): UpdateContactInput {
  const parsed = updateContactSchema.parse(input);
  if (current) {
    const discoveredAt = parsed.discoveredAt ?? current.discoveredAt;
    const lastVerifiedAt = "lastVerifiedAt" in parsed
      ? parsed.lastVerifiedAt
      : current.lastVerifiedAt;
    if (lastVerifiedAt && lastVerifiedAt < discoveredAt) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["lastVerifiedAt"],
          message: "Verification cannot precede discovery",
          input: lastVerifiedAt,
        },
      ]);
    }
  }
  return parsed;
}

export function validateContactListOptions(
  options: ContactListOptions = {},
): ValidatedContactListOptions {
  return listSchema.parse(options) as ValidatedContactListOptions;
}

export function validateContactId(value: string): string {
  return z.uuid().parse(value);
}
