import type { CompanyIntelligence } from "@/lib/ai/company-intelligence.types";

export type CompanyIntelligenceActionStatus =
  | "idle"
  | "success"
  | "validation_error"
  | "permission_error"
  | "not_found"
  | "ai_not_configured"
  | "rate_limited"
  | "timeout"
  | "provider_unavailable"
  | "invalid_model_output"
  | "unexpected";

export type CompanyIntelligenceActionState = {
  status: CompanyIntelligenceActionStatus;
  message?: string;
  intelligence?: CompanyIntelligence;
};

export const initialCompanyIntelligenceActionState: CompanyIntelligenceActionState =
  {
    status: "idle",
  };
