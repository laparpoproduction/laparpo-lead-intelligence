import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  LeadActivityRepositoryNotFoundError,
  SupabaseLeadActivityRepository,
} from "./lead-activity.repository";
import { validateLeadActivityCreate } from "./lead-activity.validation";

type Response = { data: unknown; error: unknown; count?: number | null };
type RecordedCall = { method: string; args: unknown[] };

class QueryBuilder implements PromiseLike<Response> {
  constructor(
    private readonly response: Response,
    readonly calls: RecordedCall[] = [],
  ) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }

  select(...args: unknown[]) { return this.record("select", args); }
  insert(...args: unknown[]) { return this.record("insert", args); }
  update(...args: unknown[]) { return this.record("update", args); }
  eq(...args: unknown[]) { return this.record("eq", args); }
  is(...args: unknown[]) { return this.record("is", args); }
  not(...args: unknown[]) { return this.record("not", args); }
  gte(...args: unknown[]) { return this.record("gte", args); }
  lte(...args: unknown[]) { return this.record("lte", args); }
  order(...args: unknown[]) { return this.record("order", args); }
  range(...args: unknown[]) { return this.record("range", args); }
  single() { this.record("single", []); return Promise.resolve(this.response); }
  maybeSingle() { this.record("maybeSingle", []); return Promise.resolve(this.response); }
  then<TResult1 = Response, TResult2 = never>(
    onfulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function setup(
  fromResponse: Response,
  rpcResponse: Response | Response[] = { data: [], error: null, count: 0 },
) {
  const calls: RecordedCall[] = [];
  const rpcResponses = Array.isArray(rpcResponse)
    ? [...rpcResponse]
    : [rpcResponse];
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return new QueryBuilder(fromResponse, calls);
    },
    rpc: (name: string, args?: unknown) => {
      calls.push({ method: "rpc", args: [name, args] });
      return new QueryBuilder(
        rpcResponses.shift() ?? { data: [], error: null, count: 0 },
        calls,
      );
    },
  } as unknown as Pick<SupabaseClient, "from" | "rpc">;
  return {
    repository: new SupabaseLeadActivityRepository(client),
    calls,
  };
}

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  lead_id: "22222222-2222-4222-8222-222222222222",
  activity_type: "call",
  subject: "Discovery call",
  description: null,
  activity_at: "2026-07-24T01:00:00.000Z",
  next_follow_up_at: null,
  outcome: null,
  created_by: "33333333-3333-4333-8333-333333333333",
  assigned_to: null,
  created_at: "2026-07-24T01:01:00.000Z",
  updated_at: "2026-07-24T01:01:00.000Z",
  deleted_at: null,
};

describe("SupabaseLeadActivityRepository", () => {
  it("creates an activity with actor-bound provenance", async () => {
    const { repository, calls } = setup({ data: row, error: null });
    await expect(
      repository.create(
        validateLeadActivityCreate({
          leadId: row.lead_id,
          activityType: "call",
          activityAt: row.activity_at,
        }),
        row.created_by,
      ),
    ).resolves.toMatchObject({ id: row.id, createdBy: row.created_by });
    expect(calls.find((call) => call.method === "insert")?.args[0]).toMatchObject({
      created_by: row.created_by,
      lead_id: row.lead_id,
    });
  });

  it("gets active activities by id and excludes deleted rows", async () => {
    const { repository, calls } = setup({ data: row, error: null });
    await expect(repository.getById(row.id)).resolves.toMatchObject({ id: row.id });
    expect(calls).toContainEqual({ method: "is", args: ["deleted_at", null] });
  });

  it("lists a Lead timeline with filters and deterministic ordering", async () => {
    const { repository, calls } = setup({
      data: [row],
      error: null,
      count: 26,
    });
    const result = await repository.listByLead(row.lead_id, {
      activityType: "call",
      assignedTo: row.created_by,
      fromActivityAt: "2026-07-01T00:00:00.000Z",
      toActivityAt: "2026-07-31T00:00:00.000Z",
      page: 2,
      pageSize: 10,
    });
    expect(result).toMatchObject({ total: 26, totalPages: 3, page: 2 });
    expect(calls).toEqual(expect.arrayContaining([
      { method: "eq", args: ["lead_id", row.lead_id] },
      { method: "eq", args: ["activity_type", "call"] },
      { method: "range", args: [10, 19] },
    ]));
    expect(calls.filter((call) => call.method === "order")).toEqual([
      { method: "order", args: ["activity_at", { ascending: false }] },
      { method: "order", args: ["id", { ascending: true }] },
    ]);
  });

  it("updates, soft deletes, and restores without hard delete", async () => {
    const update = setup({ data: { ...row, outcome: "Qualified" }, error: null });
    await expect(
      update.repository.update(row.id, { outcome: "Qualified" }),
    ).resolves.toMatchObject({ outcome: "Qualified" });
    expect(update.calls.some((call) => call.method === "update")).toBe(true);

    const remove = setup(
      { data: null, error: null },
      { data: row.id, error: null },
    );
    await expect(remove.repository.softDelete(row.id)).resolves.toBeUndefined();
    expect(remove.calls).toContainEqual({
      method: "rpc",
      args: ["archive_lead_activity", { target_activity_id: row.id }],
    });

    const restore = setup(
      { data: null, error: null },
      { data: row.id, error: null },
    );
    await expect(restore.repository.restore(row.id)).resolves.toBeUndefined();
    expect(restore.calls).toContainEqual({
      method: "rpc",
      args: ["restore_lead_activity", { target_activity_id: row.id }],
    });
    expect(remove.calls.some((call) => call.method === "delete")).toBe(false);
  });

  it("lists archived activities through the management RPC", async () => {
    const { repository, calls } = setup(
      { data: [], error: null },
      { data: [{ ...row, deleted_at: "2026-07-25T00:00:00.000Z" }], error: null, count: 1 },
    );
    await expect(repository.listArchived()).resolves.toMatchObject({ total: 1 });
    expect(calls).toContainEqual({
      method: "rpc",
      args: ["list_archived_lead_activities", undefined],
    });
  });

  it("scopes archived activity retrieval to one Lead", async () => {
    const { repository, calls } = setup(
      { data: [], error: null },
      {
        data: [{ ...row, deleted_at: "2026-07-25T00:00:00.000Z" }],
        error: null,
        count: 1,
      },
    );
    await expect(
      repository.listArchivedByLead(row.lead_id, {
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({ total: 1 });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["lead_id", row.lead_id],
    });
  });

  it("reports zero-row mutations as not found", async () => {
    const { repository } = setup(
      { data: null, error: null },
      { data: null, error: null },
    );
    await expect(
      repository.update(row.id, { subject: "Missing" }),
    ).rejects.toBeInstanceOf(LeadActivityRepositoryNotFoundError);
    await expect(repository.softDelete(row.id)).rejects.toBeInstanceOf(
      LeadActivityRepositoryNotFoundError,
    );
  });
});
