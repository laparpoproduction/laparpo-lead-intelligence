import type {
  PipelineSummaryFocusCode,
  PipelineSummaryProjection,
  PipelineSummaryStructuredOutput,
  RenderedPipelineSummary,
} from "./opportunity-pipeline-summary.types";

const focusCopy: Record<
  PipelineSummaryFocusCode,
  { heading: string; reason: string; action: string }
> = {
  overdue_expected_close: {
    heading: "Expected-close dates that have passed",
    reason: "These Opportunities have an expected-close date earlier than today.",
    action: "Review the Opportunities and decide whether the expected-close plan needs updating.",
  },
  unassigned_active: {
    heading: "Unassigned active Opportunities",
    reason: "These active Opportunities do not currently have a recorded owner.",
    action: "Review ownership in the normal Opportunity workspace.",
  },
  missing_expected_close: {
    heading: "Missing expected-close dates",
    reason: "These active Opportunities do not have an expected-close date recorded.",
    action: "Review whether an expected-close planning date should be recorded.",
  },
  review_probability_override: {
    heading: "Probability overrides to review",
    reason: "These Opportunities use a persisted manual probability override.",
    action: "Confirm that the recorded override still reflects the current sales plan.",
  },
  quotation_follow_up: {
    heading: "Quotation follow-up",
    reason: "These Opportunities are currently in the Quotation Sent stage.",
    action: "Review the normal Opportunity workspace and choose any follow-up yourself.",
  },
  negotiation_follow_up: {
    heading: "Negotiation follow-up",
    reason: "These Opportunities are currently in the Negotiation stage.",
    action: "Review the normal Opportunity workspace and choose any follow-up yourself.",
  },
};

const overviewCopy = {
  no_active_opportunities:
    "Your accessible pipeline contains no active Opportunities.",
  limited_pipeline_data:
    "This AI-assisted summary covers a bounded portion of your accessible active Opportunities. Review the grounded items below without treating this sample as complete pipeline coverage.",
  pipeline_no_grounded_attention:
    "No configured attention signals were found in the accessible active Opportunities.",
  pipeline_has_actionable_items:
    "AI-assisted prioritization found grounded review items in your accessible active Opportunities.",
  pipeline_requires_attention:
    "AI-assisted prioritization found grounded items that may need timely review in your accessible active Opportunities.",
} as const;

export function renderPipelineSummary(
  projection: PipelineSummaryProjection,
  output: PipelineSummaryStructuredOutput,
): RenderedPipelineSummary {
  const snapshot = projection.providerSnapshot;
  const overview = overviewCopy[output.overviewCode];

  return {
    overview,
    activeOpportunityCount: snapshot.activeOpportunityCount,
    analyzedCandidateCount: snapshot.analyzedCandidateCount,
    candidateLimit: snapshot.candidateLimit,
    focusAreas: output.focusAreas.map((focus) => ({
      code: focus.code,
      ...focusCopy[focus.code],
      opportunities: focus.opportunityIds.map((id) => {
        const opportunity = projection.displayById.get(id);
        if (!opportunity) throw new InvalidPipelineSummaryRenderError();
        return opportunity;
      }),
    })),
  };
}

export class InvalidPipelineSummaryRenderError extends Error {
  constructor() {
    super("Opportunity pipeline summary display mapping is invalid");
    this.name = "InvalidPipelineSummaryRenderError";
  }
}
