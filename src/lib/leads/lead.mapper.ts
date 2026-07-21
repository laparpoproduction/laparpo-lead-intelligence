import type {
  Lead,
  LeadInsert,
  LeadRow,
  LeadUpdate,
  UpdateLeadInput,
  ValidatedCreateLeadInput,
} from "./lead.types";

export function mapLeadRow(row: LeadRow): Lead {
  return {
    id: row.id,
    companyId: row.company_id,
    primaryContactId: row.primary_contact_id,
    title: row.title,
    stage: row.stage,
    leadStatus: row.lead_status,
    qualificationStatus: row.qualification_status,
    priority: row.priority,
    leadScore: row.lead_score,
    estimatedValue: row.estimated_value,
    currency: row.currency,
    serviceInterest: row.service_interest as Lead["serviceInterest"],
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    sourceSignalId: row.source_signal_id,
    sourceCampaign: row.source_campaign,
    referralName: row.referral_name,
    discoveredAt: row.discovered_at,
    lastVerifiedAt: row.last_verified_at,
    businessNeed: row.business_need,
    budgetNotes: row.budget_notes,
    timelineNotes: row.timeline_notes,
    decisionMakerNotes: row.decision_maker_notes,
    expectedCloseDate: row.expected_close_date,
    nextStep: row.next_step,
    nextFollowUpAt: row.next_follow_up_at,
    lastContactedAt: row.last_contacted_at,
    notes: row.notes,
    convertedAt: row.converted_at,
    lostAt: row.lost_at,
    lostReason: row.lost_reason,
    disqualifiedAt: row.disqualified_at,
    disqualifiedReason: row.disqualified_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    fingerprint: row.fingerprint,
  };
}

export function mapLeadCreate(
  input: ValidatedCreateLeadInput,
  createdBy: string,
): LeadInsert {
  return {
    company_id: input.companyId ?? null,
    primary_contact_id: input.primaryContactId ?? null,
    title: input.title,
    stage: input.stage,
    lead_status: input.leadStatus,
    qualification_status: input.qualificationStatus,
    priority: input.priority,
    lead_score: input.leadScore ?? null,
    estimated_value: input.estimatedValue ?? null,
    currency: input.currency,
    service_interest: input.serviceInterest ?? null,
    assigned_to: input.assignedTo ?? null,
    created_by: createdBy,
    source_type: input.sourceType,
    source_url: input.sourceUrl ?? null,
    source_signal_id: input.sourceSignalId ?? null,
    source_campaign: input.sourceCampaign ?? null,
    referral_name: input.referralName ?? null,
    discovered_at: input.discoveredAt,
    last_verified_at: input.lastVerifiedAt ?? null,
    business_need: input.businessNeed ?? null,
    budget_notes: input.budgetNotes ?? null,
    timeline_notes: input.timelineNotes ?? null,
    decision_maker_notes: input.decisionMakerNotes ?? null,
    expected_close_date: input.expectedCloseDate ?? null,
    next_step: input.nextStep ?? null,
    next_follow_up_at: input.nextFollowUpAt ?? null,
    last_contacted_at: input.lastContactedAt ?? null,
    notes: input.notes ?? null,
    converted_at: input.convertedAt ?? null,
    lost_at: input.lostAt ?? null,
    lost_reason: input.lostReason ?? null,
    disqualified_at: input.disqualifiedAt ?? null,
    disqualified_reason: input.disqualifiedReason ?? null,
  };
}

const updateFieldMap = {
  companyId: "company_id",
  primaryContactId: "primary_contact_id",
  title: "title",
  stage: "stage",
  leadStatus: "lead_status",
  qualificationStatus: "qualification_status",
  priority: "priority",
  leadScore: "lead_score",
  estimatedValue: "estimated_value",
  currency: "currency",
  serviceInterest: "service_interest",
  assignedTo: "assigned_to",
  sourceType: "source_type",
  sourceUrl: "source_url",
  sourceSignalId: "source_signal_id",
  sourceCampaign: "source_campaign",
  referralName: "referral_name",
  discoveredAt: "discovered_at",
  lastVerifiedAt: "last_verified_at",
  businessNeed: "business_need",
  budgetNotes: "budget_notes",
  timelineNotes: "timeline_notes",
  decisionMakerNotes: "decision_maker_notes",
  expectedCloseDate: "expected_close_date",
  nextStep: "next_step",
  nextFollowUpAt: "next_follow_up_at",
  lastContactedAt: "last_contacted_at",
  notes: "notes",
  convertedAt: "converted_at",
  lostAt: "lost_at",
  lostReason: "lost_reason",
  disqualifiedAt: "disqualified_at",
  disqualifiedReason: "disqualified_reason",
} as const;

export function mapLeadUpdate(input: UpdateLeadInput): LeadUpdate {
  const output: LeadUpdate = {};
  for (const [source, target] of Object.entries(updateFieldMap) as Array<
    [keyof typeof updateFieldMap, (typeof updateFieldMap)[keyof typeof updateFieldMap]]
  >) {
    if (source in input) {
      (output as Record<string, unknown>)[target] = input[source] ?? null;
    }
  }
  return output;
}
