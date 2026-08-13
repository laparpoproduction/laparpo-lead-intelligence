import type { RenderedPipelineSummary } from "@/lib/ai/opportunity-pipeline-summary.types";

export type OpportunityPipelineSummaryActionState = {
  status:
    | "idle"
    | "success"
    | "validation_error"
    | "permission_error"
    | "ai_not_configured"
    | "ai_disabled"
    | "rate_limited"
    | "timeout"
    | "provider_unavailable"
    | "invalid_model_output"
    | "unexpected";
  message: string;
  summary?: RenderedPipelineSummary;
};

export const initialOpportunityPipelineSummaryActionState: OpportunityPipelineSummaryActionState = {
  status: "idle",
  message: "",
};
