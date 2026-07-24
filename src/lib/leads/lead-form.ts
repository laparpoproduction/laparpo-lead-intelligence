import { z } from "zod";
import { leadPriorityValues, leadQualificationValues, leadServiceInterestValues, leadSourceTypeValues, leadStageValues, leadStatusValues, type CreateLeadInput, type UpdateLeadInput } from "./lead.types";

const optionalNullableString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const optionalNullableUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.uuid().nullable().optional(),
);

const optionalServiceInterest = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.enum(leadServiceInterestValues).nullable().optional(),
);

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const optionalTimestamp = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.iso.datetime({ offset: true }).optional(),
);

const optionalNullableTimestamp = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.iso.datetime({ offset: true }).nullable().optional(),
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
);

const leadFormFields = {
  companyId: optionalNullableUuid,
  primaryContactId: optionalNullableUuid,
  title: z.string().trim().min(1, "Title is required"),
  stage: z.enum(leadStageValues).optional(),
  leadStatus: z.enum(leadStatusValues).optional(),
  qualificationStatus: z.enum(leadQualificationValues).optional(),
  priority: z.enum(leadPriorityValues).optional(),
  leadScore: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.coerce.number().int().nonnegative().max(100).nullable().optional(),
  ),
  estimatedValue: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.coerce.number().nonnegative().nullable().optional(),
  ),
  currency: optionalString,
  serviceInterest: optionalServiceInterest,
  assignedTo: optionalNullableUuid,
  sourceType: z.enum(leadSourceTypeValues).optional(),
  sourceUrl: optionalNullableString,
  sourceSignalId: optionalNullableUuid,
  sourceCampaign: optionalNullableString,
  referralName: optionalNullableString,
  discoveredAt: optionalTimestamp,
  lastVerifiedAt: optionalNullableTimestamp,
  businessNeed: optionalNullableString,
  budgetNotes: optionalNullableString,
  timelineNotes: optionalNullableString,
  decisionMakerNotes: optionalNullableString,
  expectedCloseDate: optionalDate,
  nextStep: optionalNullableString,
  nextFollowUpAt: optionalNullableTimestamp,
  lastContactedAt: optionalNullableTimestamp,
  notes: optionalNullableString,
  convertedAt: optionalNullableTimestamp,
  lostAt: optionalNullableTimestamp,
  lostReason: optionalNullableString,
  disqualifiedAt: optionalNullableTimestamp,
  disqualifiedReason: optionalNullableString,
};

export const createLeadFormSchema = z.object(leadFormFields).superRefine((value, context) => {
  if (!value.title) {
    context.addIssue({ code: "custom", path: ["title"], message: "Title is required" });
  }
  if (!value.sourceType) {
    context.addIssue({ code: "custom", path: ["sourceType"], message: "Source type is required" });
  }
  if (!value.discoveredAt) {
    context.addIssue({ code: "custom", path: ["discoveredAt"], message: "Discovered at is required" });
  }
});

export const updateLeadFormSchema = z.object(leadFormFields).partial().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one lead field is required",
});

export const deleteLeadFormSchema = z.object({
  leadId: z.uuid("Invalid lead ID"),
  confirm: z.preprocess(
    (value) => value === true || value === "true" || value === "on" || value === "1",
    z.literal(true, { error: "Confirm lead archive" }),
  ),
});

const leadFieldNames = Object.keys(leadFormFields) as Array<keyof typeof leadFormFields>;

function formDataValue(formData: FormData, field: string): FormDataEntryValue | undefined {
  const value = formData.get(field);
  return value === null ? undefined : value;
}

function leadFormRecord(formData: FormData, includeMissing: boolean): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const field of leadFieldNames) {
    const value = formDataValue(formData, field);
    if (includeMissing || value !== undefined) record[field] = value;
  }
  return record;
}

export type ParsedLeadCreateForm = {
  input: CreateLeadInput;
  confirmationToken?: string;
};

export type ParsedLeadUpdateForm = {
  leadId: string;
  input: UpdateLeadInput;
  confirmationToken?: string;
};

export function parseCreateLeadForm(formData: FormData): ParsedLeadCreateForm {
  return {
    input: createLeadFormSchema.parse(leadFormRecord(formData, true)) as CreateLeadInput,
    confirmationToken: optionalString.parse(formDataValue(formData, "confirmationToken")),
  };
}

export function parseUpdateLeadForm(formData: FormData): ParsedLeadUpdateForm {
  return {
    leadId: z.uuid("Invalid lead ID").parse(formDataValue(formData, "leadId")),
    input: updateLeadFormSchema.parse(leadFormRecord(formData, false)) as UpdateLeadInput,
    confirmationToken: optionalString.parse(formDataValue(formData, "confirmationToken")),
  };
}

export function parseDeleteLeadForm(formData: FormData) {
  return deleteLeadFormSchema.parse({
    leadId: formDataValue(formData, "leadId"),
    confirm: formDataValue(formData, "confirm"),
  });
}
