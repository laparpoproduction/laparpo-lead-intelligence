import { z } from "zod";
import { appRoleSchema } from "@/lib/auth/permissions";
import {
  opportunityLossReasonValues,
  opportunityPipelineStageValues,
  opportunityServiceValues,
  type LeadConversionRecord,
  type LeadConversionRecordRow,
  type LeadConversionResult,
  type Opportunity,
  type OpportunityListItem,
  type OpportunityListRow,
  type OpportunityOwnerProfile,
  type OpportunityOwnerProfileRow,
  type OpportunityRow,
} from "./opportunity.types";

export function mapLeadConversionRecord(
  row: LeadConversionRecordRow,
): LeadConversionRecord {
  return {
    leadId: row.lead_id,
    opportunityId: row.opportunity_id,
    convertedAt: row.converted_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

const conversionResultSchema = z.object({
  lead_id: z.uuid(),
  opportunity_id: z.uuid(),
  conversion_status: z.enum(["converted", "already_converted"]),
});

function optionalMoney(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid Opportunity money");
  return parsed;
}

export function mapOpportunityRow(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    leadId: row.lead_id,
    service: z.enum(opportunityServiceValues).parse(row.service),
    estimatedValueMyr: optionalMoney(row.estimated_value_myr),
    quotationNumber: row.quotation_number,
    quotationSentAt: row.quotation_sent_at,
    meetingAt: row.meeting_at,
    depositAmountMyr: optionalMoney(row.deposit_amount_myr),
    depositReceivedAt: row.deposit_received_at,
    pipelineStage: z.enum(opportunityPipelineStageValues).parse(
      row.pipeline_stage,
    ),
    probabilityPercent: z.number().int().min(0).max(100).parse(
      row.probability_percent,
    ),
    probabilityOverridden: z.boolean().parse(row.probability_overridden),
    expectedCloseDate: z.iso.date().nullable().parse(row.expected_close_date),
    ownerId: z.uuid().nullable().parse(row.owner_id),
    wonAt: z.iso.datetime({ offset: true }).nullable().parse(row.won_at),
    lostAt: z.iso.datetime({ offset: true }).nullable().parse(row.lost_at),
    lostReason: z.enum(opportunityLossReasonValues).nullable().parse(
      row.lost_reason,
    ),
    lostReasonNotes: z.string().nullable().parse(row.lost_reason_notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOpportunityListRow(
  row: OpportunityListRow,
): OpportunityListItem {
  return {
    ...mapOpportunityRow(row),
    leadTitle: z.string().min(1).parse(row.lead_title),
    companyId: z.uuid().nullable().parse(row.company_id),
    companyName: z.string().nullable().parse(row.company_name),
    isConversion: z.boolean().parse(row.conversion_opportunity),
    convertedAt: z.iso.datetime({ offset: true }).nullable().parse(row.converted_at),
  };
}

export function mapOpportunityOwnerProfile(
  row: OpportunityOwnerProfileRow,
): OpportunityOwnerProfile {
  const fullName = z.string().nullable().parse(row.full_name)?.trim() || null;

  return {
    id: z.uuid().parse(row.id),
    fullName,
    role: appRoleSchema.parse(row.role),
    isActive: z.boolean().parse(row.is_active),
  };
}

export function mapLeadConversionResult(value: unknown): LeadConversionResult {
  const row = Array.isArray(value) ? value[0] : value;
  const parsed = conversionResultSchema.parse(row);
  return {
    leadId: parsed.lead_id,
    opportunityId: parsed.opportunity_id,
    status: parsed.conversion_status,
  };
}
