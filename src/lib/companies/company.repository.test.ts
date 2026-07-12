import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  CompanyRepositoryError,
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

  it("gets active companies by id, fingerprint, and normalised domain", async () => {
    for (const action of [
      (repository: SupabaseCompanyRepository) => repository.getById(companyId),
      (repository: SupabaseCompanyRepository) =>
        repository.getByFingerprint(companyFixture.fingerprint),
      (repository: SupabaseCompanyRepository) =>
        repository.getByDomain("https://www.EXAMPLE.my/menu"),
    ]) {
      const { repository, builder } = setup({ data: companyRowFixture, error: null });
      expect(await action(repository)).toEqual(companyFixture);
      expect(builder.calls).toContainEqual({ method: "is", args: ["deleted_at", null] });
    }
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

    const deleteSetup = setup({ data: null, error: null });
    await deleteSetup.repository.softDelete(companyId);
    const payload = deleteSetup.builder.calls.find((call) => call.method === "update")?.args[0];
    expect(payload).toMatchObject({ deleted_at: expect.stringMatching(/^\d{4}-/) });
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
