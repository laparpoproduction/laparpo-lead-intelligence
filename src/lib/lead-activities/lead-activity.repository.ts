import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapLeadActivityCreate,
  mapLeadActivityRow,
  mapLeadActivityUpdate,
} from "./lead-activity.mapper";
import type {
  LeadActivity,
  LeadActivityListOptions,
  LeadActivityUpdateInput,
  PaginatedLeadActivities,
  ValidatedLeadActivityCreateInput,
} from "./lead-activity.types";
import {
  validateLeadActivityId,
  validateLeadActivityListOptions,
} from "./lead-activity.validation";

export class LeadActivityRepositoryError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Unable to ${operation} Lead activity`, { cause });
    this.name = "LeadActivityRepositoryError";
  }
}

export class LeadActivityRepositoryNotFoundError extends LeadActivityRepositoryError {
  constructor(operation: string) {
    super(operation);
    this.name = "LeadActivityRepositoryNotFoundError";
  }
}

export interface LeadActivityRepository {
  create(
    input: ValidatedLeadActivityCreateInput,
    createdBy: string,
  ): Promise<LeadActivity>;
  getById(id: string, includeDeleted?: boolean): Promise<LeadActivity | null>;
  listByLead(
    leadId: string,
    options?: LeadActivityListOptions,
  ): Promise<PaginatedLeadActivities>;
  update(id: string, input: LeadActivityUpdateInput): Promise<LeadActivity>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  listArchived(
    options?: LeadActivityListOptions,
  ): Promise<PaginatedLeadActivities>;
  listArchivedByLead(
    leadId: string,
    options?: LeadActivityListOptions,
  ): Promise<PaginatedLeadActivities>;
}

type DatabaseClient = Pick<SupabaseClient, "from" | "rpc">;

function causeFrom(error: unknown): Error | undefined {
  if (!error) return undefined;
  return error instanceof Error ? error : new Error(String(error));
}

export class SupabaseLeadActivityRepository
  implements LeadActivityRepository
{
  constructor(private readonly client: DatabaseClient) {}

  async create(
    input: ValidatedLeadActivityCreateInput,
    createdBy: string,
  ): Promise<LeadActivity> {
    const { data, error } = await this.client
      .from("lead_activities")
      .insert(mapLeadActivityCreate(input, createdBy))
      .select("*")
      .single();
    if (error || !data) {
      throw new LeadActivityRepositoryError("create", causeFrom(error));
    }
    return mapLeadActivityRow(data);
  }

  async getById(
    id: string,
    includeDeleted = false,
  ): Promise<LeadActivity | null> {
    const source = includeDeleted
      ? this.client.rpc("list_archived_lead_activities")
      : this.client.from("lead_activities");
    let query = source.select("*").eq("id", validateLeadActivityId(id));
    if (!includeDeleted) query = query.is("deleted_at", null);
    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new LeadActivityRepositoryError("get by id", causeFrom(error));
    }
    return data ? mapLeadActivityRow(data) : null;
  }

  listByLead(
    leadId: string,
    options: LeadActivityListOptions = {},
  ): Promise<PaginatedLeadActivities> {
    return this.listFrom(
      this.client.from("lead_activities"),
      { ...options },
      validateLeadActivityId(leadId),
      false,
    );
  }

  async update(
    id: string,
    input: LeadActivityUpdateInput,
  ): Promise<LeadActivity> {
    const { data, error } = await this.client
      .from("lead_activities")
      .update(mapLeadActivityUpdate(input))
      .eq("id", validateLeadActivityId(id))
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (error) {
      throw new LeadActivityRepositoryError("update", causeFrom(error));
    }
    if (!data) throw new LeadActivityRepositoryNotFoundError("update");
    return mapLeadActivityRow(data);
  }

  async softDelete(id: string): Promise<void> {
    const validatedId = validateLeadActivityId(id);
    const { data, error } = await this.client.rpc("archive_lead_activity", {
      target_activity_id: validatedId,
    });
    if (error) {
      throw new LeadActivityRepositoryError("soft delete", causeFrom(error));
    }
    if (data !== validatedId) {
      throw new LeadActivityRepositoryNotFoundError("soft delete");
    }
  }

  async restore(id: string): Promise<void> {
    const validatedId = validateLeadActivityId(id);
    const { data, error } = await this.client.rpc("restore_lead_activity", {
      target_activity_id: validatedId,
    });
    if (error) {
      throw new LeadActivityRepositoryError("restore", causeFrom(error));
    }
    if (data !== validatedId) {
      throw new LeadActivityRepositoryNotFoundError("restore");
    }
  }

  listArchived(
    options: LeadActivityListOptions = {},
  ): Promise<PaginatedLeadActivities> {
    return this.listFrom(
      this.client.rpc("list_archived_lead_activities"),
      options,
      undefined,
      true,
    );
  }

  listArchivedByLead(
    leadId: string,
    options: LeadActivityListOptions = {},
  ): Promise<PaginatedLeadActivities> {
    return this.listFrom(
      this.client.rpc("list_archived_lead_activities"),
      options,
      validateLeadActivityId(leadId),
      true,
    );
  }

  private async listFrom(
    source:
      | ReturnType<DatabaseClient["from"]>
      | ReturnType<DatabaseClient["rpc"]>,
    options: LeadActivityListOptions,
    leadId: string | undefined,
    archived: boolean,
  ): Promise<PaginatedLeadActivities> {
    const parsed = validateLeadActivityListOptions(options);
    const start = (parsed.page - 1) * parsed.pageSize;
    const end = start + parsed.pageSize - 1;
    let query = source.select("*", { count: "exact" });
    if (!archived) query = query.is("deleted_at", null);
    if (leadId) query = query.eq("lead_id", leadId);
    if (parsed.activityType) {
      query = query.eq("activity_type", parsed.activityType);
    }
    if (parsed.assignedTo) query = query.eq("assigned_to", parsed.assignedTo);
    if (parsed.fromActivityAt) {
      query = query.gte("activity_at", parsed.fromActivityAt);
    }
    if (parsed.toActivityAt) {
      query = query.lte("activity_at", parsed.toActivityAt);
    }
    const { data, error, count } = await query
      .order("activity_at", { ascending: parsed.sortDirection === "asc" })
      .order("id", { ascending: true })
      .range(start, end);
    if (error) {
      throw new LeadActivityRepositoryError(
        archived ? "list archived" : "list by Lead",
        causeFrom(error),
      );
    }
    const total = count ?? 0;
    return {
      items: (data ?? []).map(mapLeadActivityRow),
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / parsed.pageSize),
    };
  }
}
