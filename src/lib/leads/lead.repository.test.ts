import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { LeadRepositoryNotFoundError, SupabaseLeadRepository } from "./lead.repository";
import { validateLeadCreate } from "./lead.validation";

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
  lt(...args: unknown[]) { return this.record("lt", args); }
  gte(...args: unknown[]) { return this.record("gte", args); }
  ilike(...args: unknown[]) { return this.record("ilike", args); }
  or(...args: unknown[]) { return this.record("or", args); }
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

function setup(fromResponse: Response, rpcResponse: Response | Response[] = { data: [], error: null, count: 0 }) {
  const calls: RecordedCall[] = [];
  const rpcResponses = Array.isArray(rpcResponse) ? [...rpcResponse] : [rpcResponse];
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return new QueryBuilder(fromResponse, calls);
    },
    rpc: (name: string, args?: unknown) => {
      calls.push({ method: "rpc", args: [name, args] });
      return new QueryBuilder(rpcResponses.shift() ?? { data: [], error: null, count: 0 }, calls);
    },
  } as unknown as Pick<SupabaseClient, "from" | "rpc">;

  return { repository: new SupabaseLeadRepository(client), calls };
}

const leadRowFixture = {
  id: "11111111-1111-4111-8111-111111111111",
  company_id: null,
  primary_contact_id: null,
  title: "KFC Ramadan",
  stage: "new",
  lead_status: "active",
  qualification_status: "unreviewed",
  priority: "high",
  lead_score: 42,
  estimated_value: 2500,
  currency: "MYR",
  service_interest: "food_review",
  assigned_to: null,
  created_by: "44444444-4444-4444-8444-444444444444",
  source_type: "company_website",
  source_url: "https://example.my/lead",
  source_signal_id: null,
  source_campaign: "q1-campaign",
  referral_name: null,
  discovered_at: "2026-06-01T00:00:00.000Z",
  last_verified_at: null,
  business_need: "Need content",
  budget_notes: null,
  timeline_notes: null,
  decision_maker_notes: null,
  expected_close_date: "2026-06-15",
  next_step: "Send quote",
  next_follow_up_at: "2026-06-05T00:00:00.000Z",
  last_contacted_at: null,
  notes: "A note",
  converted_at: null,
  lost_at: null,
  lost_reason: null,
  disqualified_at: null,
  disqualified_reason: null,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-02T00:00:00.000Z",
  deleted_at: null,
  fingerprint: "0123456789abcdef0123456789abcdef",
};

describe("SupabaseLeadRepository", () => {
  it("creates and maps a lead", async () => {
    const { repository, calls } = setup({ data: leadRowFixture, error: null });
    const created = await repository.create(
      validateLeadCreate({
        title: "KFC Ramadan",
        sourceUrl: "https://example.my/lead",
        sourceType: "company_website",
        discoveredAt: "2026-06-01T00:00:00.000Z",
      }),
      "44444444-4444-4444-8444-444444444444",
    );

    expect(created.title).toBe("KFC Ramadan");
    expect(calls.find((call) => call.method === "insert")?.args[0]).toMatchObject({
      title: "KFC Ramadan",
      created_by: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("gets an active lead by id", async () => {
    const { repository, calls } = setup({ data: leadRowFixture, error: null });
    await expect(repository.getById("11111111-1111-4111-8111-111111111111")).resolves.toMatchObject({
      id: leadRowFixture.id,
    });
    expect(calls).toContainEqual({ method: "is", args: ["deleted_at", null] });
  });

  it("supports search, filters, deterministic sorting, and pagination", async () => {
    const { repository, calls } = setup({ data: [leadRowFixture], error: null, count: 26 });
    const result = await repository.search({
      query: "KFC",
      companyId: "22222222-2222-4222-8222-222222222222",
      assignedTo: "33333333-3333-4333-8333-333333333333",
      stage: "new",
      leadStatus: "active",
      page: 2,
      pageSize: 10,
      sortBy: "title",
      sortDirection: "asc",
    });

    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 26, totalPages: 3 });
    expect(calls).toContainEqual({ method: "range", args: [10, 19] });
    expect(calls.filter((call) => call.method === "order")).toEqual([
      { method: "order", args: ["title", { ascending: true }] },
      { method: "order", args: ["id", { ascending: true }] },
    ]);
  });

  it("lists archived leads through the management RPC", async () => {
    const { repository, calls } = setup({ data: [], error: null }, { data: [leadRowFixture], error: null, count: 1 });
    const result = await repository.listArchived({ pageSize: 25 });
    expect(result.total).toBe(1);
    expect(calls).toContainEqual({ method: "rpc", args: ["list_archived_leads", undefined] });
  });

  it("paginates through duplicate candidates", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...leadRowFixture, id: `${index.toString().padStart(8, "0")}-1111-4111-8111-111111111111` }));
    const finalCandidate = { ...leadRowFixture, id: "99999999-1111-4111-8111-111111111111" };
    const { repository, calls } = setup({ data: null, error: null }, [
      { data: firstPage, error: null },
      { data: [finalCandidate], error: null },
    ]);

    await expect(repository.findDuplicateCandidates({ title: "KFC Ramadan", companyId: "22222222-2222-4222-8222-222222222222" })).resolves.toHaveLength(101);
    expect(calls.filter((call) => call.method === "rpc")).toHaveLength(2);
    expect(calls.filter((call) => call.method === "range")).toEqual([
      { method: "range", args: [0, 99] },
      { method: "range", args: [100, 199] },
    ]);
  });

  it("returns overdue and upcoming follow-up leads with deterministic ordering", async () => {
    const { repository, calls } = setup({ data: [leadRowFixture], error: null, count: 1 });
    await expect(repository.listOverdueFollowUps({ pageSize: 10 })).resolves.toMatchObject({ total: 1 });
    await expect(repository.listUpcomingFollowUps({ pageSize: 10 })).resolves.toMatchObject({ total: 1 });
    const orderCalls = calls.filter((call) => call.method === "order");
    expect(orderCalls).toEqual(expect.arrayContaining([
      { method: "order", args: ["next_follow_up_at", { ascending: true }] },
      { method: "order", args: ["id", { ascending: true }] },
    ]));
  });

  it("returns empty pagination for null follow-up query results", async () => {
    const overdue = setup({ data: null, error: null, count: null });
    await expect(overdue.repository.listOverdueFollowUps({ pageSize: 10 })).resolves.toMatchObject({
      items: [],
      total: 0,
      totalPages: 0,
      page: 1,
      pageSize: 10,
    });

    const upcoming = setup({ data: null, error: null, count: null });
    await expect(upcoming.repository.listUpcomingFollowUps({ pageSize: 10 })).resolves.toMatchObject({
      items: [],
      total: 0,
      totalPages: 0,
      page: 1,
      pageSize: 10,
    });
  });

  it("reports zero-row update and delete results as not found", async () => {
    const update = setup({ data: null, error: null });
    await expect(update.repository.update("11111111-1111-4111-8111-111111111111", { title: "Updated" })).rejects.toBeInstanceOf(LeadRepositoryNotFoundError);
    const remove = setup({ data: null, error: null });
    await expect(remove.repository.softDelete("11111111-1111-4111-8111-111111111111")).rejects.toBeInstanceOf(LeadRepositoryNotFoundError);
  });
});
