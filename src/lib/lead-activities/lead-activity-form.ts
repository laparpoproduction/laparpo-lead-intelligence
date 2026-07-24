import { z } from "zod";
import { leadActivityTypeValues } from "./lead-activity.types";
import {
  validateLeadActivityCreate,
  validateLeadActivityUpdate,
} from "./lead-activity.validation";

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalNullableText = z.preprocess(
  emptyToNull,
  z.string().trim().nullable().optional(),
);
const optionalNullableUuid = z.preprocess(
  emptyToNull,
  z.uuid().nullable().optional(),
);
const optionalTimestamp = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.iso.datetime({ offset: true }).optional(),
);
const optionalNullableTimestamp = z.preprocess(
  emptyToNull,
  z.iso.datetime({ offset: true }).nullable().optional(),
);

const activityFormFields = {
  activityType: z.enum(leadActivityTypeValues),
  subject: optionalNullableText,
  description: optionalNullableText,
  activityAt: optionalTimestamp,
  nextFollowUpAt: optionalNullableTimestamp,
  outcome: optionalNullableText,
  assignedTo: optionalNullableUuid,
};

const createFormSchema = z.object({
  leadId: z.uuid("Invalid lead ID"),
  ...activityFormFields,
});
const updateFormSchema = z
  .object(activityFormFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one activity field is required",
  });
const mutationIdSchema = z.object({
  activityId: z.uuid("Invalid activity ID"),
  confirm: z.preprocess(
    (value) =>
      value === true || value === "true" || value === "on" || value === "1",
    z.literal(true, { error: "Confirm activity mutation" }),
  ),
});

const mutableFieldNames = Object.keys(activityFormFields) as Array<
  keyof typeof activityFormFields
>;

function formValue(
  formData: FormData,
  field: string,
): FormDataEntryValue | undefined {
  const value = formData.get(field);
  return value === null ? undefined : value;
}

function mutableRecord(
  formData: FormData,
  includeMissing: boolean,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const field of mutableFieldNames) {
    const value = formValue(formData, field);
    if (includeMissing || value !== undefined) record[field] = value;
  }
  return record;
}

export function parseCreateLeadActivityForm(formData: FormData) {
  const raw = createFormSchema.parse({
    leadId: formValue(formData, "leadId"),
    ...mutableRecord(formData, true),
  });
  return validateLeadActivityCreate(raw);
}

export function parseUpdateLeadActivityForm(formData: FormData) {
  const activityId = z
    .uuid("Invalid activity ID")
    .parse(formValue(formData, "activityId"));
  const raw = updateFormSchema.parse(mutableRecord(formData, false));
  return {
    activityId,
    input: validateLeadActivityUpdate(raw),
  };
}

export function parseLeadActivityMutationForm(formData: FormData) {
  return mutationIdSchema.parse({
    activityId: formValue(formData, "activityId"),
    confirm: formValue(formData, "confirm"),
  });
}
