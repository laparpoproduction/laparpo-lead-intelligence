import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  CompanyRepositoryError,
  CompanyRepositoryNotFoundError,
  SupabaseCompanyRepository,
} from "./company.repository";
import { validateCompanyCreate } from "./company.validation";
import { companyFixture, companyId, companyRowFixture, userId } from "./company.test-fixtures";

type Response = { data: unknown; error: unknown; count?: number | null };
type RecordedCall = { method: string; args: unknown[] };

class QueryBuilder implements PromiseLike<Response> {
  readonly calls: RecordedCall[] = [];

  constructor(private readonly response: Response) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }

  select(...args: unknown[]) { return this.record("select", args); }
  insert(...args: unknown[]) { return this.record("insert", args); }
  update(...args: unknown[]) { return this.record("update", args); }
  eq(...args: unknown[]) { return this.record("eq", args); }
  is(...args: unknown[]) { return this.record("is", args); }
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

function setup(response: Response, rpcResponse: Response = { data: true, error: null }) {
  const builder = new QueryBuilder(response);
  const client = {
    from: (table: string) => {
      builder.calls.push({ method: "from", args: [table] });
      return builder;
    },
    rpc: (name: string, args: unknown) => {
      builder.calls.push({ method: "rpc", args: [name, args] });
      return Promise.resolve(rpcResponse);
    },
  } as unknown as Pick<SupabaseClient, "from" | "rpc">;
  return { repository: new SupabaseCompanyRepository(client), builder };
}

describe("SupabaseCompanyRepository", () => {
  it("creates and maps a company", async () => {
    const { repository, builder } = setup({ data: companyRowFixture, error: null });
    const created = await repository.create(
      validateCompanyCreate({
        legalName: companyFixture.legalName,
        displayName: companyFixture.displayName,
        companyType: "fnb",
        sourceUrl: companyFixture.sourceUrl,
        sourceType: companyFixture.sourceType,
      }),
      userId,
    );

    expect(created).toEqual(companyFixture);
    expect(builder.calls.find((call) => call.method === "insert")?.args[0]).toMatchObject({
      legal_name: companyFixture.legalName,
      created_by: userId,
    });
  });

  it("gets an active company by its unique id", async () => {
    const { repository, builder } = setup({ data: companyRowFixture, error: null });
    expect(await repository.getById(companyId)).toEqual(companyFixture);
    expect(builder.calls).toContainEqual({ method: "is", args: ["deleted_at", null] });
  });

  it("returns both active companies sharing one domain without a multiple-row lookup", async () => {
    const secondRow = {
      ...companyRowFixture,
      id: "33333333-3333-4333-8333-333333333333",
      display_name: "ABC Penang Branch",
    };
    const { repository, builder } = setup({
      data: [companyRowFixture, secondRow],
      error: null,
    });

    await expect(repository.findByDomain("https://www.EXAMPLE.my/menu")).resolves.toHaveLength(2);
    expect(builder.calls).toContainEqual({ method: "eq", args: ["website_domain", "example.my"] });
    expect(builder.calls).toContainEqual({ method: "is", args: ["deleted_at", null] });
    expect(builder.calls.filter((call) => call.method === "order")).toEqual([
      { method: "order", args: ["created_at", { ascending: true }] },
      { method: "order", args: ["id", { ascending: true }] },
    ]);
    expect(builder.calls.some((call) => call.method === "maybeSingle")).toBe(false);
  });

  it("returns both active companies sharing one fingerprint", async () => {
    const secondRow = {
      ...companyRowFixture,
      id: "33333333-3333-4333-8333-333333333333",
      display_name: "ABC Penang Branch",
    };
    const { repository, builder } = setup({
      data: [companyRowFixture, secondRow],
      error: null,
    });

    await expect(repository.findByFingerprint(companyFixture.fingerprint)).resolves.toHaveLength(2);
    expect(builder.calls).toContainEqual({
      method: "eq",
      args: ["fingerprint", companyFixture.fingerprint],
    });
    expect(builder.calls.some((call) => call.method === "maybeSingle")).toBe(false);
  });

  it("excludes deleted matches by default and includes them only when requested", async () => {
    const deletedRow = {
      ...companyRowFixture,
      id: "33333333-3333-4333-8333-333333333333",
      deleted_at: "2026-07-12T01:00:00.000Z",
    };
    const activeSetup = setup({ data: [companyRowFixture], error: null });
    await expect(activeSetup.repository.findByDomain("example.my")).resolves.toHaveLength(1);
    expect(activeSetup.builder.calls).toContainEqual({
      method: "is",
      args: ["deleted_at", null],
    });

    const allSetup = setup({ data: [companyRowFixture, deletedRow], error: null });
    await expect(
      allSetup.repository.findByDomain("example.my", { includeDeleted: true }),
    ).resolves.toHaveLength(2);
    expect(allSetup.builder.calls.some((call) => call.method === "is")).toBe(false);
  });

  it("returns an empty array when a domain or fingerprint has no matches", async () => {
    const domainSetup = setup({ data: [], error: null });
    await expect(domainSetup.repository.findByDomain("missing.example")).resolves.toEqual([]);

    const fingerprintSetup = setup({ data: [], error: null });
    await expect(
      fingerprintSetup.repository.findByFingerprint(companyFixture.fingerprint),
    ).resolves.toEqual([]);
  });

  it("applies filters, escaped search, sorting, and pagination", async () => {
    const { repository, builder } = setup({
      data: [companyRowFixture],
      error: null,
      count: 26,
    });
    const result = await repository.search({
      query: 'ABC (Malaysia), "Sdn Bhd"',
      domain: "www.example.my",
      city: "George Town",
      state: "Penang",
      industry: "Food & Beverage",
      companyType: "fnb",
      createdBy: userId,
      page: 2,
      pageSize: 10,
      sortBy: "displayName",
      sortDirection: "asc",
    });

    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 26, totalPages: 3 });
    expect(builder.calls).toContainEqual({ method: "range", args: [10, 19] });
    expect(builder.calls).toContainEqual({
      method: "order",
      args: ["display_name", { ascending: true }],
    });
    expect(builder.calls.find((call) => call.method === "or")?.args[0]).toContain('\\"Sdn Bhd\\"');
  });

  it("updates and soft deletes active companies", async () => {
    const updateSetup = setup({ data: { ...companyRowFixture, city: "Butterworth" }, error: null });
    expect(await updateSetup.repository.update(companyId, { city: "Butterworth" })).toMatchObject({
      city: "Butterworth",
    });
    expect(updateSetup.builder.calls).toContainEqual({ method: "is", args: ["deleted_at", null] });

    const deleteSetup = setup({ data: { id: companyId }, error: null });
    await deleteSetup.repository.softDelete(companyId);
    const payload = deleteSetup.builder.calls.find((call) => call.method === "update")?.args[0];
    expect(payload).toMatchObject({ deleted_at: expect.stringMatching(/^\d{4}-/) });
  });

  it("throws a clear not-found error when update or soft delete matches no active row", async () => {
    const updateSetup = setup({ data: null, error: null });
    await expect(updateSetup.repository.update(companyId, { city: "Butterworth" })).rejects.toBeInstanceOf(
      CompanyRepositoryNotFoundError,
    );

    const deleteSetup = setup({ data: null, error: null });
    await expect(deleteSetup.repository.softDelete(companyId)).rejects.toBeInstanceOf(
      CompanyRepositoryNotFoundError,
    );
  });

  it("uses the existing company access RPC", async () => {
    const { repository, builder } = setup({ data: null, error: null });
    await expect(repository.canAccess(companyId)).resolves.toBe(true);
    expect(builder.calls).toContainEqual({
      method: "rpc",
      args: ["can_access_company", { target_company_id: companyId }],
    });
  });

  it("wraps database failures", async () => {
    const { repository } = setup({ data: null, error: { message: "database unavailable" } });
    await expect(repository.getById(companyId)).rejects.toBeInstanceOf(CompanyRepositoryError);
  });
});
