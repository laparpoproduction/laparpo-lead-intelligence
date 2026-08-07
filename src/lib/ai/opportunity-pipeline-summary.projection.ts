import { z } from "zod";
import {
  OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT,
  opportunityActivePipelineStageValues,
  opportunityPipelineStageValues,
  opportunityServiceValues,
  type OpportunityPipelineSummaryReadModel,
} from "@/lib/opportunities/opportunity.types";
import {
  pipelineSummaryFocusCodeValues,
  type PipelineSummaryFocusCode,
  type PipelineSummaryOverviewCode,
  type PipelineSummaryProjection,
  type PipelineSummaryProviderOpportunity,
} from "./opportunity-pipeline-summary.types";

const readRowSchema = z
  .object({
    id: z.uuid(),
    service: z.enum(opportunityServiceValues),
    estimated_value_myr: z.union([z.number(), z.string(), z.null()]),
    quotation_number: z.string().nullable(),
    quotation_sent_at: z.string().nullable(),
    meeting_at: z.string().nullable(),
    deposit_amount_myr: z.union([z.number(), z.string(), z.null()]),
    deposit_received_at: z.string().nullable(),
    pipeline_stage: z.enum(opportunityActivePipelineStageValues),
    probability_percent: z.number().int().min(0).max(100),
    probability_overridden: z.boolean(),
    expected_close_date: z.string().nullable(),
    owner_id: z.uuid().nullable(),
    updated_at: z.iso.datetime(),
    conversion_opportunity: z.boolean(),
    lead_title: z.string().min(1).max(240),
    company_name: z.string().min(1).max(200).nullable(),
  })
  .strict();

function parseMoney(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9_999_999_999.99) {
    throw new Error("Invalid persisted Opportunity value");
  }
  return parsed;
}

function parsePlanningDate(value: string | null): string | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error("Invalid expected-close date");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid expected-close date");
  }
  return value;
}

function overviewCode(
  activeTotal: number,
  opportunities: PipelineSummaryProviderOpportunity[],
): PipelineSummaryOverviewCode {
  if (activeTotal === 0) return "no_active_opportunities";
  const codes = new Set(opportunities.flatMap((row) => row.attentionCodes));
  if (codes.size === 0) return "limited_pipeline_data";
  if (codes.has("overdue_expected_close") || codes.has("unassigned_active")) {
    return "pipeline_requires_attention";
  }
  return "pipeline_has_actionable_items";
}

export function projectOpportunityPipelineSummary(
  readModel: OpportunityPipelineSummaryReadModel,
  actorId: string,
  now: Date,
): PipelineSummaryProjection {
  const parsedActorId = z.uuid().parse(actorId);
  if (Number.isNaN(now.getTime())) throw new Error("Invalid server time");
  if (
    !Number.isInteger(readModel.activeTotal) ||
    readModel.activeTotal < 0 ||
    readModel.candidates.length > OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT
  ) {
    throw new Error("Invalid Opportunity pipeline summary bounds");
  }
  for (const stage of opportunityPipelineStageValues) {
    const count = readModel.stageCounts[stage];
    if (!Number.isInteger(count) || count < 0) {
      throw new Error("Invalid Opportunity pipeline stage count");
    }
  }

  const asOfDate = now.toISOString().slice(0, 10);
  const rows = readModel.candidates.map((row) => readRowSchema.parse(row));
  const rankedValueIds = new Set(
    rows
      .map((row) => ({ id: row.id, value: parseMoney(row.estimated_value_myr) }))
      .filter((row): row is { id: string; value: number } => row.value !== null)
      .sort((left, right) => right.value - left.value || left.id.localeCompare(right.id))
      .slice(0, 5)
      .map((row) => row.id),
  );

  const displayById = new Map();
  const opportunities: PipelineSummaryProviderOpportunity[] = rows.map((row) => {
    const expectedCloseDate = parsePlanningDate(row.expected_close_date);
    const attentionCodes: PipelineSummaryFocusCode[] = [];
    const overdueExpectedClose =
      expectedCloseDate !== null && expectedCloseDate < asOfDate;
    if (overdueExpectedClose) attentionCodes.push("overdue_expected_close");
    if (row.owner_id === null) attentionCodes.push("unassigned_active");
    if (expectedCloseDate === null) attentionCodes.push("missing_expected_close");
    if (row.probability_overridden) {
      attentionCodes.push("review_probability_override");
    }
    if (row.pipeline_stage === "quotation_sent") {
      attentionCodes.push("quotation_follow_up");
    }
    if (row.pipeline_stage === "negotiation") {
      attentionCodes.push("negotiation_follow_up");
    }
    if (rankedValueIds.has(row.id)) attentionCodes.push("high_recorded_value");

    const estimatedValueMyr = parseMoney(row.estimated_value_myr);
    displayById.set(row.id, {
      opportunityId: row.id,
      label: row.company_name
        ? `${row.lead_title} — ${row.company_name}`
        : row.lead_title,
      service: row.service,
      pipelineStage: row.pipeline_stage,
      estimatedValueMyr,
      expectedCloseDate,
    });

    return {
      opportunityId: row.id,
      pipelineStage: row.pipeline_stage,
      service: row.service,
      estimatedValueMyr,
      probabilityPercent: row.probability_percent,
      probabilityOverridden: row.probability_overridden,
      expectedCloseDate,
      ownerStatus:
        row.owner_id === null
          ? "unassigned"
          : row.owner_id === parsedActorId
            ? "assigned_to_actor"
            : "assigned_other",
      daysSinceUpdated: Math.max(
        0,
        Math.floor((now.getTime() - Date.parse(row.updated_at)) / 86_400_000),
      ),
      opportunityKind: row.conversion_opportunity ? "conversion" : "ordinary",
      quotationRecorded:
        row.quotation_number !== null || row.quotation_sent_at !== null,
      meetingRecorded: row.meeting_at !== null,
      depositRecorded:
        row.deposit_amount_myr !== null || row.deposit_received_at !== null,
      overdueExpectedClose,
      attentionCodes: pipelineSummaryFocusCodeValues.filter((code) =>
        attentionCodes.includes(code),
      ),
    };
  });
  const expectedOverviewCode = overviewCode(readModel.activeTotal, opportunities);

  return {
    providerSnapshot: {
      asOfDate,
      activeOpportunityCount: readModel.activeTotal,
      analyzedCandidateCount: opportunities.length,
      candidateLimit: OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT,
      stageCounts: readModel.stageCounts,
      opportunities,
    },
    displayById,
    expectedOverviewCode,
  };
}
