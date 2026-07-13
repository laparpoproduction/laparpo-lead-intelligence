import { z } from "zod";
import { contactStatusValues } from "./contact.types";
import type {
  Contact,
  ContactInsert,
  ContactRow,
  ContactUpdate,
  UpdateContactInput,
  ValidatedCreateContactInput,
} from "./contact.types";

const nullableText = z.string().nullable();
const nullableUuid = z.uuid().nullable();
const timestamp = z.iso.datetime({ offset: true });

const contactRowSchema: z.ZodType<ContactRow> = z.object({
  id: z.uuid(),
  company_id: nullableUuid,
  full_name: nullableText,
  first_name: nullableText,
  last_name: nullableText,
  job_title: nullableText,
  department: nullableText,
  seniority: nullableText,
  work_email: nullableText,
  personal_email: nullableText,
  public_phone: nullableText,
  mobile_phone: nullableText,
  whatsapp_phone: nullableText,
  linkedin_url: nullableText,
  facebook_url: nullableText,
  instagram_url: nullableText,
  source_url: z.string().min(1),
  source_type: z.string().min(1),
  discovered_at: timestamp,
  last_verified_at: timestamp.nullable(),
  is_primary_contact: z.boolean(),
  contact_status: z.enum(contactStatusValues),
  notes: nullableText,
  created_by: nullableUuid,
  assigned_to: nullableUuid,
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp.nullable(),
  fingerprint: z.string().regex(/^[a-f0-9]{32}$/).nullable(),
});

export function mapContactRow(row: unknown): Contact {
  const parsed = contactRowSchema.parse(row);
  return {
    id: parsed.id,
    companyId: parsed.company_id,
    fullName: parsed.full_name,
    firstName: parsed.first_name,
    lastName: parsed.last_name,
    jobTitle: parsed.job_title,
    department: parsed.department,
    seniority: parsed.seniority,
    workEmail: parsed.work_email,
    personalEmail: parsed.personal_email,
    publicPhone: parsed.public_phone,
    mobilePhone: parsed.mobile_phone,
    whatsappPhone: parsed.whatsapp_phone,
    linkedinUrl: parsed.linkedin_url,
    facebookUrl: parsed.facebook_url,
    instagramUrl: parsed.instagram_url,
    sourceUrl: parsed.source_url,
    sourceType: parsed.source_type,
    discoveredAt: parsed.discovered_at,
    lastVerifiedAt: parsed.last_verified_at,
    isPrimaryContact: parsed.is_primary_contact,
    contactStatus: parsed.contact_status,
    notes: parsed.notes,
    createdBy: parsed.created_by,
    assignedTo: parsed.assigned_to,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    deletedAt: parsed.deleted_at,
    fingerprint: parsed.fingerprint,
  };
}

export function mapContactCreate(
  input: ValidatedCreateContactInput,
  createdBy: string,
): ContactInsert {
  return {
    company_id: input.companyId ?? null,
    full_name: input.fullName ?? null,
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    job_title: input.jobTitle ?? null,
    department: input.department ?? null,
    seniority: input.seniority ?? null,
    work_email: input.workEmail ?? null,
    personal_email: input.personalEmail ?? null,
    public_phone: input.publicPhone ?? null,
    mobile_phone: input.mobilePhone ?? null,
    whatsapp_phone: input.whatsappPhone ?? null,
    linkedin_url: input.linkedinUrl ?? null,
    facebook_url: input.facebookUrl ?? null,
    instagram_url: input.instagramUrl ?? null,
    source_url: input.sourceUrl,
    source_type: input.sourceType,
    discovered_at: input.discoveredAt,
    last_verified_at: input.lastVerifiedAt ?? null,
    is_primary_contact: input.isPrimaryContact,
    contact_status: input.contactStatus,
    notes: input.notes ?? null,
    created_by: createdBy,
    assigned_to: input.assignedTo ?? null,
  };
}

const updateFieldMap = {
  companyId: "company_id",
  fullName: "full_name",
  firstName: "first_name",
  lastName: "last_name",
  jobTitle: "job_title",
  department: "department",
  seniority: "seniority",
  workEmail: "work_email",
  personalEmail: "personal_email",
  publicPhone: "public_phone",
  mobilePhone: "mobile_phone",
  whatsappPhone: "whatsapp_phone",
  linkedinUrl: "linkedin_url",
  facebookUrl: "facebook_url",
  instagramUrl: "instagram_url",
  sourceUrl: "source_url",
  sourceType: "source_type",
  discoveredAt: "discovered_at",
  lastVerifiedAt: "last_verified_at",
  isPrimaryContact: "is_primary_contact",
  contactStatus: "contact_status",
  notes: "notes",
  assignedTo: "assigned_to",
} as const satisfies Record<keyof UpdateContactInput, keyof ContactUpdate>;

export function mapContactUpdate(input: UpdateContactInput): ContactUpdate {
  const output: ContactUpdate = {};
  for (const [source, target] of Object.entries(updateFieldMap) as Array<
    [keyof typeof updateFieldMap, (typeof updateFieldMap)[keyof typeof updateFieldMap]]
  >) {
    if (source in input) {
      (output as Record<string, unknown>)[target] = input[source] ?? null;
    }
  }
  return output;
}
