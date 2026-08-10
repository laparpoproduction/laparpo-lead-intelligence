import {
  LEAD_FOLLOW_UP_CANDIDATE_LIMIT,
  LEAD_FOLLOW_UP_DISPLAY_CATEGORY_LIMIT,
  LEAD_FOLLOW_UP_DISPLAY_LEAD_LIMIT,
  leadFollowUpAttentionCodes,
  leadFollowUpEligibleStages,
  type LeadFollowUpAttentionCode,
  type LeadFollowUpOverview,
  type LeadFollowUpPriorityReadModel,
  type LeadFollowUpReadRow,
  type RenderedLeadFollowUpQueue,
} from "./lead-follow-up.types";

const eligibleStages = new Set<string>(leadFollowUpEligibleStages);
const expectedCloseStages = new Set([
  "qualified",
  "meeting_scheduled",
  "quotation_requested",
]);

const copy: Record<
  LeadFollowUpAttentionCode,
  { heading: string; reason: string; action: string }
> = {
  overdue_follow_up: {
    heading: "Overdue follow-ups",
    reason: "The recorded follow-up timestamp has passed.",
    action: "Review the Lead and its recorded follow-up timing.",
  },
  expected_close_passed: {
    heading: "Passed expected-close dates",
    reason: "The recorded expected-close date has passed.",
    action: "Review the Lead's current pre-Opportunity progress.",
  },
  replied_needs_review: {
    heading: "Replies needing review",
    reason: "The Lead is at Replied with no future follow-up recorded.",
    action: "Review the reply and decide the appropriate next CRM step.",
  },
  ready_to_contact_without_contact_record: {
    heading: "Ready to contact",
    reason: "No last-contacted timestamp is recorded.",
    action: "Review the Lead and its recorded contact metadata.",
  },
  qualified_needs_progress: {
    heading: "Qualified Leads needing progress",
    reason: "The qualified Lead has no future follow-up recorded.",
    action: "Review the qualified Lead's next recorded step.",
  },
  missing_follow_up: {
    heading: "Missing follow-up scheduling",
    reason: "No next follow-up timestamp is recorded for this stage.",
    action: "Review whether follow-up scheduling metadata should be added.",
  },
  unassigned_active: {
    heading: "Unassigned active Leads",
    reason: "The Lead is currently unassigned.",
    action: "Review ownership through the normal Lead workflow.",
  },
};

function timestamp(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid Lead follow-up timestamp");
  return parsed;
}

export function isLeadFollowUpBaseEligible(row: LeadFollowUpReadRow): boolean {
  return (
    row.lead_status === "active" &&
    row.qualification_status !== "unqualified" &&
    eligibleStages.has(row.stage)
  );
}

export function leadFollowUpAttentionCodesFor(
  row: LeadFollowUpReadRow,
  authoritativeNow: Date,
): LeadFollowUpAttentionCode[] {
  if (!isLeadFollowUpBaseEligible(row) || Number.isNaN(authoritativeNow.getTime())) {
    return [];
  }
  const now = authoritativeNow.getTime();
  const today = authoritativeNow.toISOString().slice(0, 10);
  const nextFollowUp = timestamp(row.next_follow_up_at);
  const dueNowOrPast = nextFollowUp === null || nextFollowUp <= now;
  const result: LeadFollowUpAttentionCode[] = [];

  if (nextFollowUp !== null && nextFollowUp < now) {
    result.push("overdue_follow_up");
  }
  if (
    expectedCloseStages.has(row.stage) &&
    row.expected_close_date !== null &&
    row.expected_close_date < today
  ) {
    result.push("expected_close_passed");
  }
  if (row.stage === "replied" && dueNowOrPast) {
    result.push("replied_needs_review");
  }
  if (
    row.stage === "ready_to_contact" &&
    row.last_contacted_at === null &&
    dueNowOrPast
  ) {
    result.push("ready_to_contact_without_contact_record");
  }
  if (row.stage === "qualified" && dueNowOrPast) {
    result.push("qualified_needs_progress");
  }
  if (
    (row.stage === "contacted" || row.stage === "quotation_requested") &&
    row.next_follow_up_at === null
  ) {
    result.push("missing_follow_up");
  }
  if (row.assigned_to === null) {
    result.push("unassigned_active");
  }

  return result;
}

export function deriveLeadFollowUpOverview(
  eligibleAccessibleLeadCount: number,
  configuredAttentionLeadCount: number,
  analyzedCandidateCount: number,
): LeadFollowUpOverview {
  if (eligibleAccessibleLeadCount === 0) return "no_eligible_leads";
  if (configuredAttentionLeadCount > analyzedCandidateCount) {
    return "limited_lead_data";
  }
  if (configuredAttentionLeadCount === 0) return "no_configured_attention";
  return "lead_attention_available";
}

const overviewCopy: Record<LeadFollowUpOverview, string> = {
  no_eligible_leads:
    "No accessible pre-Opportunity Leads currently meet the queue eligibility rules.",
  limited_lead_data:
    "Configured attention signals exist beyond the bounded candidate review shown below.",
  no_configured_attention:
    "No configured attention signal is recorded across the accessible eligible Leads.",
  lead_attention_available:
    "Configured attention signals are available for deterministic review.",
};

export function projectLeadFollowUpQueue(
  readModel: LeadFollowUpPriorityReadModel,
): RenderedLeadFollowUpQueue {
  const now = new Date(readModel.authoritativeNow);
  if (Number.isNaN(now.getTime())) throw new Error("Invalid authoritative queue time");
  if (readModel.authoritativeUtcDate !== now.toISOString().slice(0, 10)) {
    throw new Error("Lead follow-up request date disagrees with its request time");
  }
  if (
    !Number.isInteger(readModel.eligibleAccessibleLeadCount) ||
    !Number.isInteger(readModel.configuredAttentionLeadCount) ||
    readModel.eligibleAccessibleLeadCount < 0 ||
    readModel.configuredAttentionLeadCount < 0 ||
    readModel.configuredAttentionLeadCount >
      readModel.eligibleAccessibleLeadCount ||
    readModel.candidates.length > LEAD_FOLLOW_UP_CANDIDATE_LIMIT ||
    readModel.candidates.length > readModel.configuredAttentionLeadCount
  ) {
    throw new Error("Invalid Lead follow-up read model counts");
  }

  const seen = new Set<string>();
  const classified = readModel.candidates.map((row) => {
    if (seen.has(row.id)) throw new Error("Duplicate Lead follow-up candidate");
    seen.add(row.id);
    const codes = leadFollowUpAttentionCodesFor(row, now);
    if (codes.length === 0) {
      throw new Error("Lead follow-up candidate has no configured attention signal");
    }
    return { row, code: codes[0] };
  });

  const groups = leadFollowUpAttentionCodes
    .map((code) => ({
      code,
      matches: classified.filter((candidate) => candidate.code === code),
    }))
    .filter((group) => group.matches.length > 0)
    .slice(0, LEAD_FOLLOW_UP_DISPLAY_CATEGORY_LIMIT)
    .map(({ code, matches }) => ({
      code,
      ...copy[code],
      leads: matches.slice(0, LEAD_FOLLOW_UP_DISPLAY_LEAD_LIMIT).map(({ row }) => ({
        leadId: row.id,
        title: row.title,
        stage: row.stage,
        priority: row.priority,
        serviceInterest: row.service_interest,
        nextFollowUpAt: row.next_follow_up_at,
        expectedCloseDate: row.expected_close_date,
      })),
    }));

  const overview = deriveLeadFollowUpOverview(
    readModel.eligibleAccessibleLeadCount,
    readModel.configuredAttentionLeadCount,
    readModel.candidates.length,
  );
  return {
    overview,
    overviewText: overviewCopy[overview],
    eligibleAccessibleLeadCount: readModel.eligibleAccessibleLeadCount,
    configuredAttentionLeadCount: readModel.configuredAttentionLeadCount,
    analyzedCandidateCount: readModel.candidates.length,
    candidateLimit: LEAD_FOLLOW_UP_CANDIDATE_LIMIT,
    groups,
  };
}
