import type { LeadServiceInterest } from "@/lib/leads/lead.types";
import type {
  OpportunityLossReason,
  OpportunityPipelineStage,
  OpportunityService,
} from "./opportunity.types";

export const opportunityServiceOptions: ReadonlyArray<{
  value: OpportunityService;
  label: string;
}> = [
  { value: "food_review", label: "Food review" },
  { value: "hard_selling", label: "Hard-selling marketing video" },
  { value: "corporate", label: "Corporate video" },
  { value: "storyline_celebrity", label: "Storyline & celebrity video" },
  { value: "social_media_campaign", label: "Social media campaign" },
  { value: "event_coverage", label: "Event coverage" },
  { value: "other", label: "Other" },
];

const leadServiceMap: Record<LeadServiceInterest, OpportunityService> = {
  food_review: "food_review",
  hard_selling_video: "hard_selling",
  corporate_video: "corporate",
  storyline_celebrity: "storyline_celebrity",
  social_media_campaign: "social_media_campaign",
  event_coverage: "event_coverage",
  other: "other",
};

export function mapLeadServiceToOpportunity(
  service: string | null,
): OpportunityService | null {
  if (!service || !(service in leadServiceMap)) return null;
  return leadServiceMap[service as LeadServiceInterest];
}

export function defaultEstimatedValueMyr(
  currency: string,
  value: number | null,
): number | null {
  return currency === "MYR" &&
    value !== null &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 9_999_999_999.99
    ? value
    : null;
}

const myr = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
});

export const OPPORTUNITIES_DEFAULT_PAGE_SIZE = 25;

export const opportunityStageOptions: ReadonlyArray<{
  value: OpportunityPipelineStage;
  label: string;
}> = [
  { value: "new", label: "New" },
  { value: "discussion", label: "Discussion" },
  { value: "quotation_sent", label: "Quotation Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export const opportunityLossReasonOptions: ReadonlyArray<{
  value: OpportunityLossReason;
  label: string;
}> = [
  { value: "budget", label: "Budget" },
  { value: "competitor", label: "Competitor" },
  { value: "no_response", label: "No response" },
  { value: "postponed", label: "Postponed" },
  { value: "scope_mismatch", label: "Scope mismatch" },
  { value: "client_cancelled", label: "Client cancelled" },
  { value: "other", label: "Other" },
];

export function formatOpportunityMyr(value: number | null): string {
  return value === null ? "Not recorded" : myr.format(value);
}

export function opportunityServiceLabel(service: OpportunityService): string {
  return (
    opportunityServiceOptions.find((option) => option.value === service)?.label ??
    service
  );
}

export function opportunityStageLabel(stage: OpportunityPipelineStage): string {
  return opportunityStageOptions.find((option) => option.value === stage)!.label;
}

export function opportunityLossReasonLabel(reason: OpportunityLossReason): string {
  return opportunityLossReasonOptions.find((option) => option.value === reason)!
    .label;
}

export function compactOpportunityId(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function isOpportunityOverdue(
  expectedCloseDate: string | null,
  stage: OpportunityPipelineStage,
  now = new Date(),
): boolean {
  if (!expectedCloseDate || stage === "won" || stage === "lost") return false;
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return new Date(`${expectedCloseDate}T00:00:00.000Z`) < today;
}
