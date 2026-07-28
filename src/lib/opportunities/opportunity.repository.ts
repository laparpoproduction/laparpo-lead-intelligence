import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapLeadConversionRecord,
  mapLeadConversionResult,
  mapOpportunityListRow,
  mapOpportunityOwnerProfile,
  mapOpportunityRow,
} from "./opportunity.mapper";
import type {
  LeadConversionRecord,
  LeadConversionRecordRow,
  LeadConversionResult,
  Opportunity,
  OpportunityActivePipelineStage,
  OpportunityDetail,
  OpportunityExpectedCloseMutationInput,
  OpportunityListItem,
  OpportunityListOptions,
  OpportunityListRow,
  OpportunityLeadAccessRow,
  OpportunityLossReason,
  OpportunityLostMutationInput,
  OpportunityOwnerProfile,
  OpportunityOwnerProfileRow,
  OpportunityOwnerMutationInput,
  OpportunityProbabilityMutationInput,
  OpportunityRow,
  OpportunitySort,
  OpportunityStageMutationInput,
  OpportunityVersionedMutationInput,
  PaginatedOpportunities,
  ValidatedConvertLeadInput,
} from "./opportunity.types";
import {
  validateLeadConversion,
  validateOpportunityId,
  validateOpportunityExpectedCloseMutation,
  validateOpportunityListOptions,
  validateOpportunityLostMutation,
  validateOpportunityMutationVersion,
  validateOpportunityOwnerMutation,
  validateOpportunityProbabilityMutation,
  validateOpportunityStageMutation,
} from "./opportunity.validation";

export type OpportunityRepositoryFailure =
  | "not_found"
  | "permission_denied"
  | "inactive_actor"
  | "terminal_lead"
  | "legacy_conversion_unresolved"
  | "conversion_state_conflict"
  | "stale_conflict"
  | "terminal"
  | "owner_forbidden"
  | "owner_inactive"
  | "probability_forbidden"
  | "probability_invalid"
  | "lost_reason_required"
  | "lost_notes_required"
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
  getConversionByLead(leadId: string): Promise<LeadConversionRecord | null>;
  getById(id: string): Promise<Opportunity | null>;
  getDetailById(id: string): Promise<OpportunityDetail | null>;
  listByLead(leadId: string): Promise<Opportunity[]>;
  list(options?: OpportunityListOptions): Promise<PaginatedOpportunities>;
  listLeadAccessRows(leadIds: string[]): Promise<OpportunityLeadAccessRow[]>;
  listOwnerProfiles(): Promise<OpportunityOwnerProfile[]>;
  canModifyLead(leadId: string): Promise<boolean>;
  changePipelineStage(
    input: OpportunityStageMutationInput,
  ): Promise<Opportunity | null>;
  assignOwner(
    input: OpportunityOwnerMutationInput,
  ): Promise<Opportunity | null>;
  setExpectedCloseDate(
    input: OpportunityExpectedCloseMutationInput,
  ): Promise<Opportunity | null>;
  overrideProbability(
    input: OpportunityProbabilityMutationInput,
  ): Promise<Opportunity | null>;
  clearProbabilityOverride(
    input: OpportunityVersionedMutationInput,
  ): Promise<Opportunity | null>;
  markWon(
    input: OpportunityVersionedMutationInput,
  ): Promise<Opportunity | null>;
  markLost(input: OpportunityLostMutationInput): Promise<Opportunity | null>;
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

  if (detail === "opportunity_terminal") return "terminal";
  if (detail === "opportunity_owner_forbidden") return "owner_forbidden";
  if (detail === "opportunity_owner_inactive") return "owner_inactive";
  if (detail === "opportunity_probability_forbidden") {
    return "probability_forbidden";
  }
  if (detail === "opportunity_probability_invalid") {
    return "probability_invalid";
  }
  if (detail === "opportunity_lost_reason_required") {
    return "lost_reason_required";
  }
  if (detail === "opportunity_lost_notes_required") {
    return "lost_notes_required";
  }
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
  return new Error("Database Opportunity request failed");
}

type OpportunityMutationPatch =
  | { pipeline_stage: OpportunityActivePipelineStage | "won" }
  | {
      pipeline_stage: "lost";
      lost_reason: OpportunityLossReason;
      lost_reason_notes: string | null;
    }
  | { owner_id: string | null }
  | { expected_close_date: string | null }
  | {
      probability_percent: number;
      probability_overridden: true;
    }
  | { probability_overridden: false };

const opportunityListColumns = [
  "id",
  "lead_id",
  "service",
  "estimated_value_myr",
  "quotation_number",
  "quotation_sent_at",
  "meeting_at",
  "deposit_amount_myr",
  "deposit_received_at",
  "pipeline_stage",
  "probability_percent",
  "probability_overridden",
  "expected_close_date",
  "owner_id",
  "won_at",
  "lost_at",
  "lost_reason",
  "lost_reason_notes",
  "created_at",
  "updated_at",
  "lead_title",
  "company_id",
  "company_name",
  "conversion_opportunity",
  "converted_at",
].join(", ");

const opportunitySortColumns: Record<
  OpportunitySort,
  {
    column: "created_at" | "estimated_value_myr";
    ascending: boolean;
    nullsFirst?: boolean;
  }
> = {
  newest: { column: "created_at", ascending: false },
  oldest: { column: "created_at", ascending: true },
  value_desc: {
    column: "estimated_value_myr",
    ascending: false,
    nullsFirst: false,
  },
  value_asc: {
    column: "estimated_value_myr",
    ascending: true,
    nullsFirst: false,
  },
};

function quotePostgrestValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
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

  async getConversionByLead(
    leadId: string,
  ): Promise<LeadConversionRecord | null> {
    const { data, error } = await this.client
      .from("lead_conversions")
      .select("lead_id, opportunity_id, converted_at, created_by, created_at")
      .eq("lead_id", validateOpportunityId(leadId))
      .maybeSingle();
    if (error) {
      throw new OpportunityRepositoryError(
        "get conversion by Lead",
        classifyFailure(error),
        safeCause(error),
      );
    }
    return data
      ? mapLeadConversionRecord(data as LeadConversionRecordRow)
      : null;
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

  async getDetailById(id: string): Promise<OpportunityDetail | null> {
    const validatedId = validateOpportunityId(id);
    const { data, error } = await this.client
      .from("opportunity_list_read_model")
      .select(opportunityListColumns)
      .eq("id", validatedId)
      .maybeSingle();
    if (error) {
      throw new OpportunityRepositoryError(
        "get detail by id",
        classifyFailure(error),
        safeCause(error),
      );
    }
    if (!data) return null;
    try {
      return mapOpportunityListRow(data as unknown as OpportunityListRow);
    } catch (mappingError) {
      throw new OpportunityRepositoryError(
        "get detail response",
        "unknown",
        mappingError instanceof Error
          ? new Error("Opportunity detail read model response was invalid")
          : undefined,
      );
    }
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

  async list(
    options: OpportunityListOptions = {},
  ): Promise<PaginatedOpportunities> {
    const parsed = validateOpportunityListOptions(options);
    const start = (parsed.page - 1) * parsed.pageSize;
    const end = start + parsed.pageSize - 1;
    let query = this.client
      .from("opportunity_list_read_model")
      .select(opportunityListColumns, { count: "exact" });

    if (parsed.query) {
      const search = quotePostgrestValue(parsed.query);
      const predicates = [
        `lead_title.ilike.${search}`,
        `company_name.ilike.${search}`,
      ];
      try {
        predicates.push(`id.eq.${validateOpportunityId(parsed.query)}`);
      } catch {
        // Non-UUID search remains a safe title/company search.
      }
      query = query.or(predicates.join(","));
    }
    if (parsed.service) query = query.eq("service", parsed.service);
    if (parsed.kind !== "all") {
      query = query.eq(
        "conversion_opportunity",
        parsed.kind === "conversion",
      );
    }
    if (parsed.pipelineStage) {
      query = query.eq("pipeline_stage", parsed.pipelineStage);
    }

    const sort = opportunitySortColumns[parsed.sort];
    const { data, error, count } = await query
      .order(sort.column, {
        ascending: sort.ascending,
        nullsFirst: sort.nullsFirst,
      })
      .order("id", { ascending: true })
      .range(start, end);

    if (error) {
      throw new OpportunityRepositoryError(
        "global list",
        classifyFailure(error),
        safeCause(error),
      );
    }

    const total = count ?? 0;
    let items: OpportunityListItem[];
    try {
      items = (data ?? []).map((row) =>
        mapOpportunityListRow(row as unknown as OpportunityListRow),
      );
    } catch (mappingError) {
      throw new OpportunityRepositoryError(
        "global list response",
        "unknown",
        mappingError instanceof Error
          ? new Error("Opportunity read model response was invalid")
          : undefined,
      );
    }
    return {
      items,
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / parsed.pageSize),
    };
  }

  async listLeadAccessRows(
    leadIds: string[],
  ): Promise<OpportunityLeadAccessRow[]> {
    if (leadIds.length === 0) return [];
    const validatedIds = Array.from(
      new Set(leadIds.map((id) => validateOpportunityId(id))),
    );
    const { data, error } = await this.client
      .from("leads")
      .select("id, created_by, assigned_to")
      .in("id", validatedIds)
      .order("id", { ascending: true });
    if (error) {
      throw new OpportunityRepositoryError(
        "list Lead mutation access",
        classifyFailure(error),
        safeCause(error),
      );
    }
    return (data ?? []) as OpportunityLeadAccessRow[];
  }

  async listOwnerProfiles(): Promise<OpportunityOwnerProfile[]> {
    const { data, error } = await this.client
      .from("profiles")
      .select("id, full_name, role, is_active")
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(200);
    if (error) {
      throw new OpportunityRepositoryError(
        "list Opportunity owner profiles",
        classifyFailure(error),
        safeCause(error),
      );
    }
    try {
      return (data ?? []).map((row) =>
        mapOpportunityOwnerProfile(row as OpportunityOwnerProfileRow),
      );
    } catch {
      throw new OpportunityRepositoryError(
        "Opportunity owner profile response",
        "unknown",
      );
    }
  }

  async canModifyLead(leadId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc("can_modify_lead", {
      target_lead_id: validateOpportunityId(leadId),
    });
    if (error || typeof data !== "boolean") {
      throw new OpportunityRepositoryError(
        "check Lead mutation permission",
        classifyFailure(error),
        safeCause(error),
      );
    }
    return data;
  }

  changePipelineStage(
    input: OpportunityStageMutationInput,
  ): Promise<Opportunity | null> {
    const validated = validateOpportunityStageMutation(input);
    return this.mutate(
      validated,
      { pipeline_stage: validated.pipelineStage },
      "change pipeline stage",
    );
  }

  assignOwner(
    input: OpportunityOwnerMutationInput,
  ): Promise<Opportunity | null> {
    const validated = validateOpportunityOwnerMutation(input);
    return this.mutate(
      validated,
      { owner_id: validated.ownerId },
      "assign owner",
    );
  }

  setExpectedCloseDate(
    input: OpportunityExpectedCloseMutationInput,
  ): Promise<Opportunity | null> {
    const validated = validateOpportunityExpectedCloseMutation(input);
    return this.mutate(
      validated,
      { expected_close_date: validated.expectedCloseDate },
      "set expected close date",
    );
  }

  overrideProbability(
    input: OpportunityProbabilityMutationInput,
  ): Promise<Opportunity | null> {
    const validated = validateOpportunityProbabilityMutation(input);
    return this.mutate(
      validated,
      {
        probability_percent: validated.probabilityPercent,
        probability_overridden: true,
      },
      "override probability",
    );
  }

  clearProbabilityOverride(
    input: OpportunityVersionedMutationInput,
  ): Promise<Opportunity | null> {
    return this.mutate(
      input,
      { probability_overridden: false },
      "clear probability override",
    );
  }

  markWon(
    input: OpportunityVersionedMutationInput,
  ): Promise<Opportunity | null> {
    return this.mutate(input, { pipeline_stage: "won" }, "mark Won");
  }

  markLost(input: OpportunityLostMutationInput): Promise<Opportunity | null> {
    const validated = validateOpportunityLostMutation(input);
    return this.mutate(
      validated,
      {
        pipeline_stage: "lost",
        lost_reason: validated.lostReason,
        lost_reason_notes: validated.lostReasonNotes,
      },
      "mark Lost",
    );
  }

  private async mutate(
    input: OpportunityVersionedMutationInput,
    patch: OpportunityMutationPatch,
    operation: string,
  ): Promise<Opportunity | null> {
    const validated = validateOpportunityMutationVersion(input);
    const { data, error } = await this.client
      .from("opportunities")
      .update(patch)
      .eq("id", validated.opportunityId)
      .eq("updated_at", validated.expectedUpdatedAt)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new OpportunityRepositoryError(
        operation,
        classifyFailure(error),
        safeCause(error),
      );
    }
    if (!data) return null;
    try {
      return mapOpportunityRow(data as OpportunityRow);
    } catch {
      throw new OpportunityRepositoryError(`${operation} response`, "unknown");
    }
  }
}
