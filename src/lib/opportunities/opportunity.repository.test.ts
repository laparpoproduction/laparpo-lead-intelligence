import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  OpportunityRepositoryError,
  SupabaseOpportunityRepository,
} from "./opportunity.repository";
import { validateLeadConversion } from "./opportunity.validation";

type Response = { data: unknown; error: unknown };
type Call = { method: string; args: unknown[] };

class QueryBuilder implements PromiseLike<Response> {
  constructor(
    private readonly response: Response,
    readonly calls: Call[],
  ) {}
  private record(method: string, args: unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }
  select(...args: unknown[]) {
    return this.record("select", args);
  }
  eq(...args: unknown[]) {
    return this.record("eq", args);
  }
  order(...args: unknown[]) {
    return this.record("order", args);
  }
  or(...args: unknown[]) {
    return this.record("or", args);
  }
  range(...args: unknown[]) {
    this.record("range", args);
    return Promise.resolve(this.response);
  }
  maybeSingle() {
    this.record("maybeSingle", []);
    return Promise.resolve(this.response);
  }
  then<TResult1 = Response, TResult2 = never>(
    onfulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function setup(responses: Response[]) {
  const calls: Call[] = [];
  const queue = [...responses];
  const client = {
    rpc: (name: string, args?: unknown) => {
      calls.push({ method: "rpc", args: [name, args] });
      return new QueryBuilder(
        queue.shift() ?? { data: null, error: null },
        calls,
      );
    },
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return new QueryBuilder(
        queue.shift() ?? { data: [], error: null },
        calls,
      );
    },
  } as unknown as Pick<SupabaseClient, "from" | "rpc">;
  return { repository: new SupabaseOpportunityRepository(client), calls };
}

const leadId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";
const row = {
  id: opportunityId,
  lead_id: leadId,
  service: "food_review",
  estimated_value_myr: "3500.00",
  quotation_number: null,
  quotation_sent_at: null,
  meeting_at: null,
  deposit_amount_myr: null,
  deposit_received_at: null,
  created_at: "2026-07-25T00:00:00.000Z",
  updated_at: "2026-07-25T00:00:00.000Z",
};

const listRow = {
  ...row,
  lead_title: "Domino's festive campaign",
  company_id: "33333333-3333-4333-8333-333333333333",
  company_name: "Domino's Malaysia",
  conversion_opportunity: true,
  converted_at: "2026-07-25T00:00:00.000Z",
};

describe("SupabaseOpportunityRepository", () => {
  it("invokes only the atomic conversion RPC and maps retry status", async () => {
    const { repository, calls } = setup([
      {
        data: [
          {
            lead_id: leadId,
            opportunity_id: opportunityId,
            conversion_status: "already_converted",
          },
        ],
        error: null,
      },
    ]);
    await expect(
      repository.convert(
        validateLeadConversion({
          leadId,
          service: "food_review",
          estimatedValueMyr: 3500,
        }),
      ),
    ).resolves.toEqual({
      leadId,
      opportunityId,
      status: "already_converted",
    });
    expect(calls).toEqual([
      {
        method: "rpc",
        args: [
          "convert_lead_to_opportunity",
          {
            target_lead_id: leadId,
            target_service: "food_review",
            target_estimated_value_myr: 3500,
          },
        ],
      },
    ]);
  });

  it("classifies database failures without exposing raw details", async () => {
    const { repository } = setup([
      {
        data: null,
        error: {
          code: "42501",
          details: "lead_not_modifiable",
          message: "sensitive database policy details",
        },
      },
    ]);
    const error = await repository
      .convert(validateLeadConversion({ leadId, service: "food_review" }))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OpportunityRepositoryError);
    expect(error).toMatchObject({ failure: "permission_denied" });
    expect((error as Error).message).not.toContain("sensitive");
    expect((error as Error).cause).not.toHaveProperty(
      "message",
      "sensitive database policy details",
    );
  });

  it("retrieves one Opportunity and a deterministic Lead-scoped list", async () => {
    const { repository, calls } = setup([
      { data: row, error: null },
      { data: [row], error: null },
    ]);
    await expect(repository.getById(opportunityId)).resolves.toMatchObject({
      id: opportunityId,
    });
    await expect(repository.listByLead(leadId)).resolves.toHaveLength(1);
    expect(calls).toContainEqual({
      method: "eq",
      args: ["lead_id", leadId],
    });
    expect(calls).toContainEqual({
      method: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(calls).toContainEqual({
      method: "order",
      args: ["id", { ascending: true }],
    });
  });

  it("retrieves only the current Lead conversion ledger record", async () => {
    const { repository, calls } = setup([
      {
        data: {
          lead_id: leadId,
          opportunity_id: opportunityId,
          converted_at: "2026-07-27T08:00:00.000Z",
          created_by: leadId,
          created_at: "2026-07-27T08:00:00.000Z",
        },
        error: null,
      },
    ]);
    await expect(repository.getConversionByLead(leadId)).resolves.toMatchObject({
      leadId,
      opportunityId,
    });
    expect(calls).toContainEqual({
      method: "from",
      args: ["lead_conversions"],
    });
    expect(calls).toContainEqual({ method: "eq", args: ["lead_id", leadId] });
  });

  it("lists a page from the RLS-backed read model without loading all rows", async () => {
    const { repository, calls } = setup([
      { data: [listRow], error: null, count: 31 } as Response,
    ]);
    await expect(
      repository.list({
        query: " Domino's ",
        service: "food_review",
        kind: "conversion",
        sort: "newest",
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          id: opportunityId,
          leadTitle: "Domino's festive campaign",
          companyName: "Domino's Malaysia",
          isConversion: true,
        },
      ],
      page: 2,
      pageSize: 25,
      total: 31,
      totalPages: 2,
    });
    expect(calls).toContainEqual({
      method: "from",
      args: ["opportunity_list_read_model"],
    });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["conversion_opportunity", true],
    });
    expect(calls).toContainEqual({ method: "range", args: [25, 49] });
  });

  it.each([
    ["newest", "created_at", false, undefined],
    ["oldest", "created_at", true, undefined],
    ["value_desc", "estimated_value_myr", false, false],
    ["value_asc", "estimated_value_myr", true, false],
  ] as const)(
    "applies allow-listed stable %s ordering",
    async (sort, column, ascending, nullsFirst) => {
      const { repository, calls } = setup([
        { data: [], error: null, count: 0 } as Response,
      ]);
      await repository.list({ sort });
      expect(calls).toContainEqual({
        method: "order",
        args: [column, { ascending, nullsFirst }],
      });
      expect(calls).toContainEqual({
        method: "order",
        args: ["id", { ascending: true }],
      });
    },
  );

  it("adds exact UUID search only for valid UUID input", async () => {
    const { repository, calls } = setup([
      { data: [], error: null, count: 0 } as Response,
    ]);
    await repository.list({ query: opportunityId });
    const searchCall = calls.find(({ method }) => method === "or");
    expect(searchCall?.args[0]).toContain(`id.eq.${opportunityId}`);
    expect(searchCall?.args[0]).toContain("lead_title.ilike.");
    expect(searchCall?.args[0]).toContain("company_name.ilike.");
  });

  it("maps list failures without retaining raw database details", async () => {
    const { repository } = setup([
      {
        data: null,
        error: { message: "secret SQL and policy name" },
      },
    ]);
    const error = await repository.list().catch((caught) => caught);
    expect(error).toBeInstanceOf(OpportunityRepositoryError);
    expect((error as Error).message).not.toContain("secret");
    expect((error as Error).cause).not.toHaveProperty(
      "message",
      "secret SQL and policy name",
    );
  });
});
