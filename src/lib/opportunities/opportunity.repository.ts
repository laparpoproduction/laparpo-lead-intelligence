import type { SupabaseClient } from "@supabase/supabase-js";
import { mapLeadConversionResult, mapOpportunityRow } from "./opportunity.mapper";
import type {
  LeadConversionResult,
  Opportunity,
  OpportunityRow,
  ValidatedConvertLeadInput,
} from "./opportunity.types";
import {
  validateLeadConversion,
  validateOpportunityId,
} from "./opportunity.validation";

export type OpportunityRepositoryFailure =
  | "not_found"
  | "permission_denied"
  | "inactive_actor"
  | "terminal_lead"
  | "legacy_conversion_unresolved"
  | "conversion_state_conflict"
  | "unsupported_service"
  | "invalid_value"
  | "unknown";

export class OpportunityRepositoryError extends Error {
  constructor(
    operation: string,
    readonly failure: OpportunityRepositoryFailure = "unknown",
    cause?: unknown,
  ) {
    super(`Opportunity repository ${operation} failed`, { cause });
    this.name = "OpportunityRepositoryError";
  }
}

export interface OpportunityRepository {
  convert(input: ValidatedConvertLeadInput): Promise<LeadConversionResult>;
  getById(id: string): Promise<Opportunity | null>;
  listByLead(leadId: string): Promise<Opportunity[]>;
}

type DatabaseClient = Pick<SupabaseClient, "from" | "rpc">;

type DatabaseError = {
  code?: unknown;
  details?: unknown;
};

function classifyFailure(error: unknown): OpportunityRepositoryFailure {
  const databaseError =
    error && typeof error === "object" ? (error as DatabaseError) : {};
  const code = typeof databaseError.code === "string" ? databaseError.code : "";
  const detail =
    typeof databaseError.details === "string" ? databaseError.details : "";

  if (code === "P0002" || detail === "lead_not_found") return "not_found";
  if (code === "42501") {
    return detail === "inactive_or_unauthenticated"
      ? "inactive_actor"
      : "permission_denied";
  }
  if (detail === "lead_terminal") return "terminal_lead";
  if (detail === "legacy_conversion_unresolved") {
    return "legacy_conversion_unresolved";
  }
  if (detail === "conversion_state_conflict") {
    return "conversion_state_conflict";
  }
  if (detail === "unsupported_service") return "unsupported_service";
  if (
    detail === "invalid_estimated_value_myr" ||
    detail === "invalid_lead_id" ||
    code === "22003" ||
    code === "22023"
  ) {
    return "invalid_value";
  }
  return "unknown";
}

function safeCause(error: unknown): Error | undefined {
  if (!error) return undefined;
  return new Error("Database conversion request failed");
}

export class SupabaseOpportunityRepository implements OpportunityRepository {
  constructor(private readonly client: DatabaseClient) {}

  async convert(
    input: ValidatedConvertLeadInput,
  ): Promise<LeadConversionResult> {
    const validated = validateLeadConversion(input);
    const { data, error } = await this.client.rpc(
      "convert_lead_to_opportunity",
      {
        target_lead_id: validated.leadId,
        target_service: validated.service,
        target_estimated_value_myr: validated.estimatedValueMyr,
      },
    );
    if (error || !data) {
      throw new OpportunityRepositoryError(
        "conversion",
        classifyFailure(error),
        safeCause(error),
      );
    }
    try {
      return mapLeadConversionResult(data);
    } catch {
      throw new OpportunityRepositoryError(
        "conversion response",
        "unknown",
      );
    }
  }

  async getById(id: string): Promise<Opportunity | null> {
    const { data, error } = await this.client
      .from("opportunities")
      .select("*")
      .eq("id", validateOpportunityId(id))
      .maybeSingle();
    if (error) {
      throw new OpportunityRepositoryError(
        "get by id",
        classifyFailure(error),
        safeCause(error),
      );
    }
    return data ? mapOpportunityRow(data as OpportunityRow) : null;
  }

  async listByLead(leadId: string): Promise<Opportunity[]> {
    const validatedLeadId = validateOpportunityId(leadId);
    const { data, error } = await this.client
      .from("opportunities")
      .select("*")
      .eq("lead_id", validatedLeadId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (error) {
      throw new OpportunityRepositoryError(
        "list by Lead",
        classifyFailure(error),
        safeCause(error),
      );
    }
    return (data ?? []).map((row) => mapOpportunityRow(row as OpportunityRow));
  }
}
