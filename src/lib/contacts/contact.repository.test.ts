import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  ContactRepositoryNotFoundError,
  SupabaseContactRepository,
} from "./contact.repository";
import {
  companyId,
  contactFixture,
  contactId,
  contactRowFixture,
  creatorId,
} from "./contact.test-fixtures";
import { validateContactCreate } from "./contact.validation";

type Response = { data: unknown; error: unknown; count?: number | null };
type RecordedCall = { method: string; args: unknown[] };

class QueryBuilder implements PromiseLike<Response> {
  constructor(
    private readonly response: Response,
    readonly calls: RecordedCall[],
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

function setup(
  fromResponse: Response,
  rpcResponse: Response | Response[] = { data: [], error: null, count: 0 },
) {
  const calls: RecordedCall[] = [];
  const rpcResponses = Array.isArray(rpcResponse) ? [...rpcResponse] : [rpcResponse];
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
  return { repository: new SupabaseContactRepository(client), calls };
}

describe("SupabaseContactRepository", () => {
  it("creates and maps a Contact with server-owned createdBy", async () => {
    const { repository, calls } = setup({ data: contactRowFixture, error: null });
    const created = await repository.create(
      validateContactCreate({
        companyId,
        fullName: contactFixture.fullName,
        workEmail: contactFixture.workEmail,
        sourceUrl: contactFixture.sourceUrl,
        sourceType: contactFixture.sourceType,
        discoveredAt: contactFixture.discoveredAt,
      }),
      creatorId,
    );

    expect(created).toEqual(contactFixture);
    expect(calls.find((call) => call.method === "insert")?.args[0]).toMatchObject({
      full_name: contactFixture.fullName,
      created_by: creatorId,
    });
  });

  it("returns null for an inaccessible or missing active Contact", async () => {
    const { repository, calls } = setup({ data: null, error: null });
    await expect(repository.getById(contactId)).resolves.toBeNull();
    expect(calls).toContainEqual({ method: "is", args: ["deleted_at", null] });
  });

  it("uses bounded pagination, filters, safe search, and deterministic ID ordering", async () => {
    const { repository, calls } = setup({
      data: [contactRowFixture],
      error: null,
      count: 126,
    });
    const result = await repository.search({
      query: 'Nur "Aisyah"',
      companyId,
      assignedTo: contactFixture.assignedTo ?? undefined,
      createdBy: creatorId,
      contactStatus: "verified",
      isPrimaryContact: true,
      page: 2,
      pageSize: 25,
      sortBy: "fullName",
      sortDirection: "asc",
    });

    expect(result).toMatchObject({ page: 2, pageSize: 25, total: 126, totalPages: 6 });
    expect(calls).toContainEqual({ method: "range", args: [25, 49] });
    expect(calls.filter((call) => call.method === "order")).toEqual([
      { method: "order", args: ["full_name", { ascending: true }] },
      { method: "order", args: ["id", { ascending: true }] },
    ]);
    expect(calls.find((call) => call.method === "or")?.args[0]).toContain('\\"Aisyah\\"');
    expect(calls).toContainEqual({ method: "eq", args: ["is_primary_contact", true] });
  });

  it("delegates company, assignee, and creator filters to bounded list queries", async () => {
    for (const [method, id, column] of [
      ["findByCompany", companyId, "company_id"],
      ["findByAssignee", creatorId, "assigned_to"],
      ["findByCreator", creatorId, "created_by"],
    ] as const) {
      const { repository, calls } = setup({ data: [], error: null, count: 0 });
      await repository[method](id, { pageSize: 10 });
      expect(calls).toContainEqual({ method: "eq", args: [column, id] });
      expect(calls).toContainEqual({ method: "range", args: [0, 9] });
    }
  });

  it("uses the explicit management RPC for archived Contacts", async () => {
    const { repository, calls } = setup(
      { data: [], error: null },
      { data: [{ ...contactRowFixture, deleted_at: "2026-07-12T00:00:00.000Z" }], error: null, count: 1 },
    );
    const result = await repository.listArchived({ pageSize: 25 });
    expect(result.total).toBe(1);
    expect(calls).toContainEqual({ method: "rpc", args: ["list_archived_contacts", undefined] });
    expect(calls.some((call) => call.method === "from")).toBe(false);
    expect(calls.some((call) => call.method === "is")).toBe(false);
  });

  it("paginates through more than 100 targeted duplicate candidates", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...contactRowFixture,
      id: `${index.toString(16).padStart(8, "0")}-2222-4222-8222-222222222222`,
    }));
    const finalCandidate = {
      ...contactRowFixture,
      id: "99999999-2222-4222-8222-222222222222",
    };
    const { repository, calls } = setup(
      { data: null, error: null },
      [
        { data: firstPage, error: null },
        { data: [finalCandidate], error: null },
      ],
    );

    await expect(
      repository.findDuplicateCandidates({ workEmail: "AISYAH@EXAMPLE.MY" }),
    ).resolves.toHaveLength(101);
    expect(calls.filter((call) => call.method === "rpc")).toHaveLength(2);
    expect(calls.filter((call) => call.method === "range")).toEqual([
      { method: "range", args: [0, 99] },
      { method: "range", args: [100, 199] },
    ]);
    expect(calls.find((call) => call.method === "rpc")?.args[1]).toMatchObject({
      candidate_work_email: "aisyah@example.my",
    });
  });

  it("does not call the database for name-only or shared-phone-only evidence", async () => {
    const { repository, calls } = setup({ data: null, error: null });
    await expect(repository.findDuplicateCandidates({ fullName: "Alex Lee" })).resolves.toEqual([]);
    await expect(repository.findDuplicateCandidates({ publicPhone: "04-555 0100" })).resolves.toEqual([]);
    expect(calls.filter((call) => call.method === "rpc")).toHaveLength(0);
  });

  it("reports update and soft-delete zero-row results as not found", async () => {
    const update = setup({ data: null, error: null });
    await expect(update.repository.update(contactId, { notes: "Updated" })).rejects.toBeInstanceOf(
      ContactRepositoryNotFoundError,
    );

    const remove = setup({ data: null, error: null });
    await expect(remove.repository.softDelete(contactId)).rejects.toBeInstanceOf(
      ContactRepositoryNotFoundError,
    );
  });
});
