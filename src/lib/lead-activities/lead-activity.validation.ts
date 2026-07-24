import { z } from "zod";
import {
  leadActivityTypeValues,
  type LeadActivityCreateInput,
  type LeadActivityListOptions,
  type LeadActivityUpdateInput,
  type ValidatedLeadActivityCreateInput,
  type ValidatedLeadActivityListOptions,
} from "./lead-activity.types";

const timestamp = z.iso.datetime({ offset: true });
const nullableUuid = z.uuid().nullable().optional();
const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

const mutableFields = {
  activityType: z.enum(leadActivityTypeValues),
  subject: optionalText(240),
  description: optionalText(10_000),
  activityAt: timestamp,
  nextFollowUpAt: timestamp.nullable().optional(),
  outcome: optionalText(2_000),
  assignedTo: nullableUuid,
};

const createSchema = z.object({
  leadId: z.uuid(),
  ...mutableFields,
  activityAt: mutableFields.activityAt.default(() => new Date().toISOString()),
});

const updateSchema = z
  .object(mutableFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const listSchema = z
  .object({
    activityType: z.enum(leadActivityTypeValues).optional(),
    assignedTo: z.uuid().optional(),
    fromActivityAt: timestamp.optional(),
    toActivityAt: timestamp.optional(),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(25),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    (value) =>
      !value.fromActivityAt ||
      !value.toActivityAt ||
      value.fromActivityAt <= value.toActivityAt,
    { message: "Activity date range is invalid", path: ["toActivityAt"] },
  );

export function validateLeadActivityCreate(
  input: LeadActivityCreateInput,
): ValidatedLeadActivityCreateInput {
  return createSchema.parse(input);
}

export function validateLeadActivityUpdate(
  input: LeadActivityUpdateInput,
): LeadActivityUpdateInput {
  return updateSchema.parse(input);
}

export function validateLeadActivityListOptions(
  input: LeadActivityListOptions = {},
): ValidatedLeadActivityListOptions {
  return listSchema.parse(input);
}

export function validateLeadActivityId(value: string): string {
  return z.uuid().parse(value);
}
