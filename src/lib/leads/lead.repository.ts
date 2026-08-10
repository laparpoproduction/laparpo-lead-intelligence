import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { mapLeadCreate, mapLeadRow, mapLeadUpdate } from "./lead.mapper";
import { buildLeadFingerprint } from "./lead-normalization";
import {
  LEAD_FOLLOW_UP_CANDIDATE_LIMIT,
  LEAD_FOLLOW_UP_CATEGORY_LIMIT,
  leadFollowUpAttentionCodes,
  leadFollowUpEligibleStages,
  type LeadFollowUpAttentionCode,
  type LeadFollowUpPriorityReadModel,
  type LeadFollowUpReadRow,
} from "./lead-follow-up.types";
import type {
  Lead,
  LeadConfirmationContext,
  ConfirmedLeadMutationResult,
  LeadDuplicateCandidate,
  LeadListOptions,
  LeadSortField,
  PaginatedLeads,
  UpdateLeadInput,
  ValidatedCreateLeadInput,
} from "./lead.types";
import {
  leadPriorityValues,
  leadQualificationValues,
  leadServiceInterestValues,
  leadStageValues,
  leadStatusValues,
} from "./lead.types";
import { validateLeadId, validateLeadListOptions } from "./lead.validation";

export class LeadRepositoryError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Lead repository ${operation} failed`, { cause });
    this.name = "LeadRepositoryError";
  }
}

export class LeadRepositoryNotFoundError extends LeadRepositoryError {
  constructor(operation: string) {
    super(operation);
    this.message = `Lead repository ${operation} found no active lead`;
    this.name = "LeadRepositoryNotFoundError";
  }
}

export interface LeadRepository {
  create(input: ValidatedCreateLeadInput, createdBy: string): Promise<Lead>;
  createConfirmed(
    input: ValidatedCreateLeadInput,
    createdBy: string,
    confirmation: LeadConfirmationContext,
  ): Promise<ConfirmedLeadMutationResult>;
  getById(id: string, includeDeleted?: boolean): Promise<Lead | null>;
  list(options?: LeadListOptions): Promise<PaginatedLeads>;
  search(options: LeadListOptions): Promise<PaginatedLeads>;
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
  updateConfirmed(
    id: string,
    input: UpdateLeadInput,
    confirmation: LeadConfirmationContext,
  ): Promise<ConfirmedLeadMutationResult>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  listArchived(options?: LeadListOptions): Promise<PaginatedLeads>;
  listOverdueFollowUps(options?: LeadListOptions): Promise<PaginatedLeads>;
  listUpcomingFollowUps(options?: LeadListOptions): Promise<PaginatedLeads>;
  findByAssignee(userId: string, options?: LeadListOptions): Promise<PaginatedLeads>;
  findDuplicateCandidates(input: { title: string; companyId?: string | null; primaryContactId?: string | null; serviceInterest?: string | null; sourceUrl?: string | null; sourceCampaign?: string | null; sourceSignalId?: string | null }): Promise<LeadDuplicateCandidate[]>;
  getFollowUpPriorityReadModel(
    authoritativeNow: Date,
  ): Promise<LeadFollowUpPriorityReadModel>;
  canAccess(id: string): Promise<boolean>;
  canModify(id: string): Promise<boolean>;
}

type DatabaseClient = Pick<SupabaseClient, "from" | "rpc">;

const sortColumns: Record<LeadSortField, string> = {
  title: "title",
  stage: "stage",
  leadStatus: "lead_status",
  qualificationStatus: "qualification_status",
  priority: "priority",
  createdAt: "created_at",
  updatedAt: "updated_at",
  nextFollowUpAt: "next_follow_up_at",
  expectedCloseDate: "expected_close_date",
};

const duplicateCandidatePageSize = 100;

export const leadFollowUpSelectColumns = [
  "id",
  "title",
  "stage",
  "lead_status",
  "qualification_status",
  "priority",
  "service_interest",
  "assigned_to",
  "next_follow_up_at",
  "last_contacted_at",
  "expected_close_date",
  "updated_at",
].join(",");

const leadFollowUpEmbeddedSelect = `${leadFollowUpSelectColumns},opportunity_exclusion:opportunities!opportunities_lead_id_fk()`;

const followUpRowSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    stage: z.enum(leadStageValues),
    lead_status: z.enum(leadStatusValues),
    qualification_status: z.enum(leadQualificationValues),
    priority: z.enum(leadPriorityValues),
    service_interest: z.enum(leadServiceInterestValues).nullable(),
    assigned_to: z.uuid().nullable(),
    next_follow_up_at: z.string().datetime({ offset: true }).nullable(),
    last_contacted_at: z.string().datetime({ offset: true }).nullable(),
    expected_close_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .nullable(),
    updated_at: z.string().datetime({ offset: true }),
    opportunity_exclusion: z.array(z.never()).max(0).optional(),
  })
  .strict();

function mapFollowUpRow(value: unknown): LeadFollowUpReadRow {
  const { opportunity_exclusion: _excluded, ...row } =
    followUpRowSchema.parse(value);
  void _excluded;
  return row;
}

function configuredAttentionFilter(now: string, utcDate: string): string {
  return [
    `next_follow_up_at.lt.${now}`,
    `and(stage.in.(qualified,meeting_scheduled,quotation_requested),expected_close_date.lt.${utcDate})`,
    `and(stage.eq.replied,or(next_follow_up_at.is.null,next_follow_up_at.lte.${now}))`,
    `and(stage.eq.ready_to_contact,last_contacted_at.is.null,or(next_follow_up_at.is.null,next_follow_up_at.lte.${now}))`,
    `and(stage.eq.qualified,or(next_follow_up_at.is.null,next_follow_up_at.lte.${now}))`,
    "and(stage.in.(contacted,quotation_requested),next_follow_up_at.is.null)",
    "assigned_to.is.null",
  ].join(",");
}

const confirmedMutationResultSchema = z.object({
  lead_id: z.uuid(),
  already_processed: z.boolean(),
});

function mapConfirmedMutationResult(value: unknown): ConfirmedLeadMutationResult {
  const parsed = confirmedMutationResultSchema.parse(value);
  return {
    status: parsed.already_processed ? "already_processed" : "applied",
    leadId: parsed.lead_id,
  };
}

function quotePostgrestValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

function causeFrom(error: unknown): unknown {
  if (error && typeof error === "object" && "message" in error) return error;
  return new Error(String(error));
}

function toDuplicateCandidate(lead: Lead): LeadDuplicateCandidate {
  return {
    id: lead.id,
    companyId: lead.companyId,
    primaryContactId: lead.primaryContactId,
    title: lead.title,
    serviceInterest: lead.serviceInterest,
    sourceUrl: lead.sourceUrl,
    sourceCampaign: lead.sourceCampaign,
    sourceSignalId: lead.sourceSignalId,
  };
}

export class SupabaseLeadRepository implements LeadRepository {
  constructor(private readonly client: DatabaseClient) {}

  async create(input: ValidatedCreateLeadInput, createdBy: string): Promise<Lead> {
    const { data, error } = await this.client
      .from("leads")
      .insert(mapLeadCreate(input, validateLeadId(createdBy)))
      .select("*")
      .single();

    if (error || !data) throw new LeadRepositoryError("create", causeFrom(error));
    return mapLeadRow(data as unknown as Parameters<typeof mapLeadRow>[0]);
  }

  async createConfirmed(
    input: ValidatedCreateLeadInput,
    createdBy: string,
    confirmation: LeadConfirmationContext,
  ): Promise<ConfirmedLeadMutationResult> {
    const { data, error } = await this.client.rpc(
      "create_confirmed_duplicate_lead",
      {
        target_confirmation_id: validateLeadId(confirmation.confirmationId),
        target_submission_hash: confirmation.submissionHash,
        lead_data: mapLeadCreate(input, validateLeadId(createdBy)),
      },
    );
    if (error || !data) {
      throw new LeadRepositoryError("confirmed create", causeFrom(error));
    }
    try {
      return mapConfirmedMutationResult(data);
    } catch (mappingError) {
      throw new LeadRepositoryError(
        "confirmed create response",
        causeFrom(mappingError),
      );
    }
  }

  async getById(id: string, includeDeleted = false): Promise<Lead | null> {
    let query = this.client.from("leads").select("*").eq("id", validateLeadId(id));
    if (!includeDeleted) query = query.is("deleted_at", null);
    const { data, error } = await query.maybeSingle();

    if (error) throw new LeadRepositoryError("get by id", causeFrom(error));
    return data ? mapLeadRow(data as unknown as Parameters<typeof mapLeadRow>[0]) : null;
  }

  async list(options: LeadListOptions = {}): Promise<PaginatedLeads> {
    return this.listFrom(this.client.from("leads"), options, false);
  }

  search(options: LeadListOptions): Promise<PaginatedLeads> {
    return this.list(options);
  }

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    const { data, error } = await this.client
      .from("leads")
      .update(mapLeadUpdate(input))
      .eq("id", validateLeadId(id))
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) throw new LeadRepositoryError("update", causeFrom(error));
    if (!data) throw new LeadRepositoryNotFoundError("update");
    return mapLeadRow(data as unknown as Parameters<typeof mapLeadRow>[0]);
  }

  async updateConfirmed(
    id: string,
    input: UpdateLeadInput,
    confirmation: LeadConfirmationContext,
  ): Promise<ConfirmedLeadMutationResult> {
    const validatedId = validateLeadId(id);
    const { data, error } = await this.client.rpc(
      "update_confirmed_duplicate_lead",
      {
        target_confirmation_id: validateLeadId(confirmation.confirmationId),
        target_submission_hash: confirmation.submissionHash,
        target_lead_id: validatedId,
        lead_updates: mapLeadUpdate(input),
      },
    );
    if (error || !data) {
      throw new LeadRepositoryError("confirmed update", causeFrom(error));
    }
    try {
      return mapConfirmedMutationResult(data);
    } catch (mappingError) {
      throw new LeadRepositoryError(
        "confirmed update response",
        causeFrom(mappingError),
      );
    }
  }

  async softDelete(id: string): Promise<void> {
    const { data, error } = await this.client
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", validateLeadId(id))
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) throw new LeadRepositoryError("soft delete", causeFrom(error));
    if (!data) throw new LeadRepositoryNotFoundError("soft delete");
  }

  async restore(id: string): Promise<void> {
    const validatedId = validateLeadId(id);
    const { data, error } = await this.client.rpc("restore_archived_lead", {
      target_lead_id: validatedId,
    });

    if (error) throw new LeadRepositoryError("restore", causeFrom(error));
    if (!data) throw new LeadRepositoryNotFoundError("restore");
    if (data !== validatedId) {
      throw new LeadRepositoryError(
        "restore response",
        new Error("Unexpected restored Lead identifier"),
      );
    }
  }

  async listArchived(options: LeadListOptions = {}): Promise<PaginatedLeads> {
    return this.listFrom(this.client.rpc("list_archived_leads"), options, true);
  }

  async listOverdueFollowUps(options: LeadListOptions = {}): Promise<PaginatedLeads> {
    const parsed = validateLeadListOptions(options);
    const start = (parsed.page - 1) * parsed.pageSize;
    const end = start + parsed.pageSize - 1;
    let query = this.client.from("leads").select("*", { count: "exact" });
    if (!parsed.includeDeleted) query = query.is("deleted_at", null);
    query = query.lt("next_follow_up_at", new Date().toISOString());
    const { data, error, count } = await query
      .order("next_follow_up_at", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end);

    if (error) throw new LeadRepositoryError("list overdue follow-ups", causeFrom(error));
    return this.paginate(data ?? [], count ?? 0, parsed.page, parsed.pageSize);
  }

  async listUpcomingFollowUps(options: LeadListOptions = {}): Promise<PaginatedLeads> {
    const parsed = validateLeadListOptions(options);
    const start = (parsed.page - 1) * parsed.pageSize;
    const end = start + parsed.pageSize - 1;
    let query = this.client.from("leads").select("*", { count: "exact" });
    if (!parsed.includeDeleted) query = query.is("deleted_at", null);
    query = query.gte("next_follow_up_at", new Date().toISOString());
    const { data, error, count } = await query
      .order("next_follow_up_at", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end);

    if (error) throw new LeadRepositoryError("list upcoming follow-ups", causeFrom(error));
    return this.paginate(data ?? [], count ?? 0, parsed.page, parsed.pageSize);
  }

  async findByAssignee(userId: string, options: LeadListOptions = {}): Promise<PaginatedLeads> {
    return this.list({ ...options, assignedTo: validateLeadId(userId) });
  }

  async findDuplicateCandidates(input: {
    title: string;
    companyId?: string | null;
    primaryContactId?: string | null;
    serviceInterest?: string | null;
    sourceUrl?: string | null;
    sourceCampaign?: string | null;
    sourceSignalId?: string | null;
  }): Promise<LeadDuplicateCandidate[]> {
    const fingerprint = buildLeadFingerprint(input);
    if (!fingerprint) return [];

    const candidates: LeadDuplicateCandidate[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await this.client
        .rpc("find_lead_duplicate_candidates", {
          candidate_title: input.title,
          candidate_company_id: input.companyId ?? null,
          candidate_primary_contact_id: input.primaryContactId ?? null,
          candidate_service_interest: input.serviceInterest ?? null,
          candidate_source_url: input.sourceUrl ?? null,
          candidate_source_campaign: input.sourceCampaign ?? null,
          candidate_source_signal_id: input.sourceSignalId ?? null,
        })
        .order("id", { ascending: true })
        .range(offset, offset + duplicateCandidatePageSize - 1);

      if (error) throw new LeadRepositoryError("find duplicate candidates", causeFrom(error));
      const page = (data ?? []).map((row: unknown) => toDuplicateCandidate(mapLeadRow(row as unknown as Parameters<typeof mapLeadRow>[0])));
      candidates.push(...page);
      if (page.length < duplicateCandidatePageSize) return candidates;
      offset += duplicateCandidatePageSize;
    }
  }

  async getFollowUpPriorityReadModel(
    authoritativeNow: Date,
  ): Promise<LeadFollowUpPriorityReadModel> {
    if (Number.isNaN(authoritativeNow.getTime())) {
      throw new LeadRepositoryError(
        "follow-up queue",
        new Error("Invalid authoritative time"),
      );
    }
    const now = authoritativeNow.toISOString();
    const utcDate = now.slice(0, 10);
    const attentionFilter = configuredAttentionFilter(now, utcDate);

    const [eligibleResult, attentionResult] = await Promise.all([
      this.followUpBaseQuery({ count: "exact", head: true }),
      this.followUpBaseQuery({ count: "exact", head: true }).or(attentionFilter),
    ]);
    if (eligibleResult.error || attentionResult.error) {
      throw new LeadRepositoryError(
        "follow-up queue counts",
        causeFrom(eligibleResult.error ?? attentionResult.error),
      );
    }
    const eligibleCount = eligibleResult.count;
    const attentionCount = attentionResult.count;
    if (
      typeof eligibleCount !== "number" ||
      typeof attentionCount !== "number" ||
      !Number.isInteger(eligibleCount) ||
      !Number.isInteger(attentionCount) ||
      eligibleCount < 0 ||
      attentionCount < 0 ||
      attentionCount > eligibleCount
    ) {
      throw new LeadRepositoryError(
        "follow-up queue counts",
        new Error("Exact Lead follow-up counts are unavailable"),
      );
    }

    const candidates: LeadFollowUpReadRow[] = [];
    const selected = new Set<string>();
    for (const code of leadFollowUpAttentionCodes) {
      await this.appendFollowUpCandidates(
        candidates,
        selected,
        code,
        LEAD_FOLLOW_UP_CATEGORY_LIMIT,
        now,
        utcDate,
        attentionFilter,
      );
    }
    const remaining = LEAD_FOLLOW_UP_CANDIDATE_LIMIT - candidates.length;
    if (remaining > 0) {
      await this.appendFollowUpCandidates(
        candidates,
        selected,
        "fallback",
        remaining,
        now,
        utcDate,
        attentionFilter,
      );
    }

    return {
      candidates,
      eligibleAccessibleLeadCount: eligibleCount,
      configuredAttentionLeadCount: attentionCount,
      authoritativeNow: now,
      authoritativeUtcDate: utcDate,
    };
  }

  async canAccess(id: string): Promise<boolean> {
    const { data, error } = await this.client.rpc("can_access_lead", {
      target_lead_id: validateLeadId(id),
    });
    if (error) throw new LeadRepositoryError("permission check", causeFrom(error));
    return data === true;
  }

  private followUpBaseQuery(
    options?: { count: "exact"; head: true },
  ) {
    const query = this.client
      .from("leads")
      .select(leadFollowUpEmbeddedSelect, options)
      .is("opportunity_exclusion", null)
      .is("deleted_at", null)
      .eq("lead_status", "active")
      .neq("qualification_status", "unqualified")
      .in("stage", [...leadFollowUpEligibleStages]);
    return query;
  }

  private async appendFollowUpCandidates(
    candidates: LeadFollowUpReadRow[],
    selected: Set<string>,
    code: LeadFollowUpAttentionCode | "fallback",
    limit: number,
    now: string,
    utcDate: string,
    attentionFilter: string,
  ): Promise<void> {
    if (limit <= 0) return;
    let query = this.followUpBaseQuery();
    if (selected.size > 0) {
      query = query.not("id", "in", `(${[...selected].join(",")})`);
    }

    switch (code) {
      case "overdue_follow_up":
        query = query
          .lt("next_follow_up_at", now)
          .order("next_follow_up_at", { ascending: true })
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true });
        break;
      case "expected_close_passed":
        query = query
          .in("stage", ["qualified", "meeting_scheduled", "quotation_requested"])
          .lt("expected_close_date", utcDate)
          .order("expected_close_date", { ascending: true })
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true });
        break;
      case "replied_needs_review":
        query = query
          .eq("stage", "replied")
          .or(`next_follow_up_at.is.null,next_follow_up_at.lte.${now}`)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true });
        break;
      case "ready_to_contact_without_contact_record":
        query = query
          .eq("stage", "ready_to_contact")
          .is("last_contacted_at", null)
          .or(`next_follow_up_at.is.null,next_follow_up_at.lte.${now}`)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true });
        break;
      case "qualified_needs_progress":
        query = query
          .eq("stage", "qualified")
          .or(`next_follow_up_at.is.null,next_follow_up_at.lte.${now}`)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true });
        break;
      case "missing_follow_up":
        query = query
          .in("stage", ["contacted", "quotation_requested"])
          .is("next_follow_up_at", null)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true });
        break;
      case "unassigned_active":
        query = query
          .is("assigned_to", null)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true });
        break;
      case "fallback":
        query = query
          .or(attentionFilter)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true });
        break;
    }

    const { data, error } = await query.limit(limit);
    if (error) {
      throw new LeadRepositoryError(
        `follow-up queue ${code}`,
        causeFrom(error),
      );
    }
    let rows: LeadFollowUpReadRow[];
    try {
      rows = (data ?? []).map(mapFollowUpRow);
    } catch (error) {
      throw new LeadRepositoryError(
        `follow-up queue ${code} response`,
        causeFrom(error),
      );
    }
    if (rows.length > limit) {
      throw new LeadRepositoryError(
        `follow-up queue ${code} response`,
        new Error("Database exceeded the requested Lead row limit"),
      );
    }
    for (const row of rows) {
      if (selected.has(row.id)) {
        throw new LeadRepositoryError(
          `follow-up queue ${code} duplicate`,
          new Error("Database returned an already-selected Lead"),
        );
      }
      selected.add(row.id);
      candidates.push(row);
    }
  }

  async canModify(id: string): Promise<boolean> {
    const { data, error } = await this.client.rpc("can_modify_lead", {
      target_lead_id: validateLeadId(id),
    });
    if (error) throw new LeadRepositoryError("permission check", causeFrom(error));
    return data === true;
  }

  private async listFrom(
    source: ReturnType<DatabaseClient["from"]> | ReturnType<DatabaseClient["rpc"]>,
    options: LeadListOptions,
    archived: boolean,
  ): Promise<PaginatedLeads> {
    const parsed = validateLeadListOptions(options);
    const start = (parsed.page - 1) * parsed.pageSize;
    const end = start + parsed.pageSize - 1;

    let query = source.select("*", { count: "exact" });
    if (!archived) query = query.is("deleted_at", null);
    if (parsed.companyId) query = query.eq("company_id", parsed.companyId);
    if (parsed.assignedTo) query = query.eq("assigned_to", parsed.assignedTo);
    if (parsed.createdBy) query = query.eq("created_by", parsed.createdBy);
    if (parsed.stage) query = query.eq("stage", parsed.stage);
    if (parsed.leadStatus) query = query.eq("lead_status", parsed.leadStatus);
    if (parsed.qualificationStatus) query = query.eq("qualification_status", parsed.qualificationStatus);
    if (parsed.priority) query = query.eq("priority", parsed.priority);
    if (parsed.query) {
      const value = quotePostgrestValue(parsed.query);
      query = query.or(`title.ilike.${value},service_interest.ilike.${value},source_campaign.ilike.${value}`);
    }

    const { data, error, count } = await query
      .order(sortColumns[parsed.sortBy], { ascending: parsed.sortDirection === "asc" })
      .order("id", { ascending: true })
      .range(start, end);

    if (error) throw new LeadRepositoryError(archived ? "list archived" : "list", causeFrom(error));
    return this.paginate(data ?? [], count ?? 0, parsed.page, parsed.pageSize);
  }

  private paginate(data: unknown[], count: number, page: number, pageSize: number): PaginatedLeads {
    const items = data.map((row) => mapLeadRow(row as unknown as Parameters<typeof mapLeadRow>[0]));
    const total = count ?? 0;
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
