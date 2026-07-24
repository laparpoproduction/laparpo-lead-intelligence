import { z } from "zod";
import {
  leadActivityTypeValues,
  type LeadActivity,
  type LeadActivityInsert,
  type LeadActivityRow,
  type LeadActivityUpdate,
  type LeadActivityUpdateInput,
  type ValidatedLeadActivityCreateInput,
} from "./lead-activity.types";

const timestamp = z.iso.datetime({ offset: true });
const rowSchema: z.ZodType<LeadActivityRow> = z.object({
  id: z.uuid(),
  lead_id: z.uuid(),
  activity_type: z.enum(leadActivityTypeValues),
  subject: z.string().nullable(),
  description: z.string().nullable(),
  activity_at: timestamp,
  next_follow_up_at: timestamp.nullable(),
  outcome: z.string().nullable(),
  created_by: z.uuid(),
  assigned_to: z.uuid().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp.nullable(),
});

export function mapLeadActivityRow(row: unknown): LeadActivity {
  const parsed = rowSchema.parse(row);
  return {
    id: parsed.id,
    leadId: parsed.lead_id,
    activityType: parsed.activity_type,
    subject: parsed.subject,
    description: parsed.description,
    activityAt: parsed.activity_at,
    nextFollowUpAt: parsed.next_follow_up_at,
    outcome: parsed.outcome,
    createdBy: parsed.created_by,
    assignedTo: parsed.assigned_to,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    deletedAt: parsed.deleted_at,
  };
}

export function mapLeadActivityCreate(
  input: ValidatedLeadActivityCreateInput,
  createdBy: string,
): LeadActivityInsert {
  return {
    lead_id: input.leadId,
    activity_type: input.activityType,
    subject: input.subject ?? null,
    description: input.description ?? null,
    activity_at: input.activityAt,
    next_follow_up_at: input.nextFollowUpAt ?? null,
    outcome: input.outcome ?? null,
    created_by: createdBy,
    assigned_to: input.assignedTo ?? null,
  };
}

const updateFieldMap = {
  activityType: "activity_type",
  subject: "subject",
  description: "description",
  activityAt: "activity_at",
  nextFollowUpAt: "next_follow_up_at",
  outcome: "outcome",
  assignedTo: "assigned_to",
} as const;

export function mapLeadActivityUpdate(
  input: LeadActivityUpdateInput,
): LeadActivityUpdate {
  const output: LeadActivityUpdate = {};
  for (const [source, target] of Object.entries(updateFieldMap) as Array<
    [
      keyof typeof updateFieldMap,
      (typeof updateFieldMap)[keyof typeof updateFieldMap],
    ]
  >) {
    if (source in input) {
      (output as Record<string, unknown>)[target] = input[source] ?? null;
    }
  }
  return output;
}
