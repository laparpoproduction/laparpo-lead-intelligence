import { z } from "zod";
import {
  opportunityServiceValues,
  type LeadConversionRecord,
  type LeadConversionRecordRow,
  type LeadConversionResult,
  type Opportunity,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
