import type { SupabaseClient } from "@supabase/supabase-js";
import { mapLeadCreate, mapLeadRow, mapLeadUpdate } from "./lead.mapper";
import { buildLeadFingerprint } from "./lead-normalization";
import type {
  Lead,
  LeadDuplicateCandidate,
  LeadListOptions,
  LeadSortField,
  PaginatedLeads,
  UpdateLeadInput,
  ValidatedCreateLeadInput,
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
  getById(id: string, includeDeleted?: boolean): Promise<Lead | null>;
  list(options?: LeadListOptions): Promise<PaginatedLeads>;
  search(options: LeadListOptions): Promise<PaginatedLeads>;
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  listArchived(options?: LeadListOptions): Promise<PaginatedLeads>;
  listOverdueFollowUps(options?: LeadListOptions): Promise<PaginatedLeads>;
  listUpcomingFollowUps(options?: LeadListOptions): Promise<PaginatedLeads>;
  findByAssignee(userId: string, options?: LeadListOptions): Promise<PaginatedLeads>;
  findDuplicateCandidates(input: { title: string; companyId?: string | null; primaryContactId?: string | null; serviceInterest?: string | null; sourceUrl?: string | null; sourceCampaign?: string | null; sourceSignalId?: string | null }): Promise<LeadDuplicateCandidate[]>;
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
    const { data, error } = await this.client
      .from("leads")
      .update({ deleted_at: null })
      .eq("id", validateLeadId(id))
      .not("deleted_at", "is", null)
      .select("id")
      .maybeSingle();

    if (error) throw new LeadRepositoryError("restore", causeFrom(error));
    if (!data) throw new LeadRepositoryNotFoundError("restore");
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

  async canAccess(id: string): Promise<boolean> {
    const { data, error } = await this.client.rpc("can_access_lead", {
      target_lead_id: validateLeadId(id),
    });
    if (error) throw new LeadRepositoryError("permission check", causeFrom(error));
    return data === true;
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
