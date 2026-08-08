import type {
  OpportunityPipelineStage,
  OpportunityPipelineSummaryReadModel,
  OpportunityPipelineSummaryReadRow,
} from "@/lib/opportunities/opportunity.types";

export const pipelineActorId = "11111111-1111-4111-8111-111111111111";

export function makePipelineSummaryRow(
  index: number,
  overrides: Partial<OpportunityPipelineSummaryReadRow> = {},
): OpportunityPipelineSummaryReadRow {
  const suffix = String(index).padStart(12, "0");
  return {
    id: `22222222-2222-4222-8222-${suffix}`,
    service: "corporate",
    estimated_value_myr: null,
    quotation_number: null,
    quotation_sent_at: null,
    meeting_at: null,
    deposit_amount_myr: null,
    deposit_received_at: null,
    pipeline_stage: "new",
    probability_percent: 20,
    probability_overridden: false,
    expected_close_date: "2026-09-01",
    owner_id: pipelineActorId,
    updated_at: "2026-07-01T00:00:00.000Z",
    conversion_opportunity: false,
    lead_title: `Authorized synthetic Lead ${index}`,
    company_name: `Authorized Company ${index}`,
    ...overrides,
  };
}

export function makePipelineSummaryReadModel(
  candidates: OpportunityPipelineSummaryReadRow[],
  stageCounts?: Partial<Record<OpportunityPipelineStage, number>>,
): OpportunityPipelineSummaryReadModel {
  const counts = {
    new: 0,
    discussion: 0,
    quotation_sent: 0,
    negotiation: 0,
    won: 0,
    lost: 0,
    ...stageCounts,
  };
  if (!stageCounts) {
    for (const candidate of candidates) counts[candidate.pipeline_stage] += 1;
  }
  return {
    candidates,
    activeTotal:
      counts.new + counts.discussion + counts.quotation_sent + counts.negotiation,
    stageCounts: counts,
  };
}
