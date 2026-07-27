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
});
