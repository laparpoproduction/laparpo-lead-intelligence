import type {
  OpportunityActivePipelineStage,
  OpportunityPipelineStage,
  OpportunityService,
} from "@/lib/opportunities/opportunity.types";
import type { CompanyIntelligenceModel } from "./company-intelligence.types";

export const pipelineSummaryOverviewCodeValues = [
  "no_active_opportunities",
  "limited_pipeline_data",
  "pipeline_has_actionable_items",
  "pipeline_requires_attention",
] as const;

export type PipelineSummaryOverviewCode =
  (typeof pipelineSummaryOverviewCodeValues)[number];

export const pipelineSummaryFocusCodeValues = [
  "overdue_expected_close",
  "unassigned_active",
  "missing_expected_close",
  "review_probability_override",
  "quotation_follow_up",
  "negotiation_follow_up",
  "high_recorded_value",
] as const;

export type PipelineSummaryFocusCode =
  (typeof pipelineSummaryFocusCodeValues)[number];

export const pipelineSummaryOwnerStatusValues = [
  "unassigned",
  "assigned_to_actor",
  "assigned_other",
] as const;

export type PipelineSummaryOwnerStatus =
  (typeof pipelineSummaryOwnerStatusValues)[number];

export type PipelineSummaryProviderOpportunity = {
  opportunityId: string;
  pipelineStage: OpportunityActivePipelineStage;
  service: OpportunityService;
  estimatedValueMyr: number | null;
  probabilityPercent: number;
  probabilityOverridden: boolean;
  expectedCloseDate: string | null;
  ownerStatus: PipelineSummaryOwnerStatus;
  daysSinceUpdated: number;
  opportunityKind: "conversion" | "ordinary";
  quotationRecorded: boolean;
  meetingRecorded: boolean;
  depositRecorded: boolean;
  overdueExpectedClose: boolean;
  attentionCodes: PipelineSummaryFocusCode[];
};

export type PipelineSummaryProviderSnapshot = {
  asOfDate: string;
  activeOpportunityCount: number;
  analyzedCandidateCount: number;
  candidateLimit: number;
  stageCounts: Record<OpportunityPipelineStage, number>;
  opportunities: PipelineSummaryProviderOpportunity[];
};

export type PipelineSummaryDisplayOpportunity = {
  opportunityId: string;
  label: string;
  service: OpportunityService;
  pipelineStage: OpportunityActivePipelineStage;
  estimatedValueMyr: number | null;
  expectedCloseDate: string | null;
};

export type PipelineSummaryProjection = {
  providerSnapshot: PipelineSummaryProviderSnapshot;
  displayById: Map<string, PipelineSummaryDisplayOpportunity>;
  expectedOverviewCode: PipelineSummaryOverviewCode;
};

export type PipelineSummaryStructuredOutput = {
  overviewCode: PipelineSummaryOverviewCode;
  focusAreas: Array<{
    code: PipelineSummaryFocusCode;
    opportunityIds: string[];
  }>;
};

export type RenderedPipelineSummaryFocusArea = {
  code: PipelineSummaryFocusCode;
  heading: string;
  reason: string;
  action: string;
  opportunities: PipelineSummaryDisplayOpportunity[];
};

export type RenderedPipelineSummary = {
  overview: string;
  activeOpportunityCount: number;
  analyzedCandidateCount: number;
  candidateLimit: number;
  focusAreas: RenderedPipelineSummaryFocusArea[];
};

export type PipelineSummaryUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type PipelineSummaryProviderRequest = {
  model: CompanyIntelligenceModel;
  input: [
    { role: "developer"; content: string },
    { role: "user"; content: string },
  ];
  maxOutputTokens: number;
  store: false;
};

export type PipelineSummaryProviderResult = {
  output: unknown;
  usage: PipelineSummaryUsage | null;
};

export interface PipelineSummaryProvider {
  generate(
    request: PipelineSummaryProviderRequest,
  ): Promise<PipelineSummaryProviderResult>;
}
