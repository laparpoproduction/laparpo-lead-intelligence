import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  OpportunityRepositoryError,
  SupabaseOpportunityRepository,
} from "./opportunity.repository";
import { validateLeadConversion } from "./opportunity.validation";

type Response = { data: unknown; error: unknown; count?: number | null };
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
  update(...args: unknown[]) {
    return this.record("update", args);
  }
  eq(...args: unknown[]) {
    return this.record("eq", args);
  }
  in(...args: unknown[]) {
    return this.record("in", args);
  }
  limit(...args: unknown[]) {
    return this.record("limit", args);
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
  pipeline_stage: "new",
  probability_percent: 20,
  probability_overridden: false,
  expected_close_date: null,
  owner_id: null,
  won_at: null,
  lost_at: null,
  lost_reason: null,
  lost_reason_notes: null,
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

  it("checks Lead modification permission through the existing RLS helper", async () => {
    const { repository, calls } = setup([{ data: true, error: null }]);
    await expect(repository.canModifyLead(leadId)).resolves.toBe(true);
    expect(calls).toEqual([
      {
        method: "rpc",
        args: ["can_modify_lead", { target_lead_id: leadId }],
      },
    ]);
  });

  it("loads a bounded, minimal pipeline summary from the RLS-authoritative read model", async () => {
    const summaryRow = {
      id: opportunityId,
      service: "food_review",
      estimated_value_myr: "3500.00",
      quotation_number: null,
      quotation_sent_at: null,
      meeting_at: null,
      deposit_amount_myr: null,
      deposit_received_at: null,
      pipeline_stage: "new",
      probability_percent: 20,
      probability_overridden: false,
      expected_close_date: null,
      owner_id: null,
      updated_at: row.updated_at,
      conversion_opportunity: false,
      lead_title: "Authorized Lead",
      company_name: "Authorized Company",
    };
    const { repository, calls } = setup([
      { data: [summaryRow], error: null, count: 1 },
      ...[1, 2, 3, 4, 5, 6].map((count) => ({
        data: null,
        error: null,
        count,
      })),
    ]);
    await expect(repository.getPipelineSummaryReadModel(75)).resolves.toEqual({
      candidates: [summaryRow],
      activeTotal: 1,
      stageCounts: {
        new: 1,
        discussion: 2,
        quotation_sent: 3,
        negotiation: 4,
        won: 5,
        lost: 6,
      },
    });
    expect(calls.filter((call) => call.method === "from")).toHaveLength(7);
    expect(calls).toContainEqual({
      method: "in",
      args: [
        "pipeline_stage",
        ["new", "discussion", "quotation_sent", "negotiation"],
      ],
    });
    expect(calls).toContainEqual({ method: "limit", args: [75] });
    const selectedColumns = calls.find(
      (call) =>
        call.method === "select" &&
        typeof call.args[0] === "string" &&
        call.args[0].includes("lead_title"),
    )?.args[0] as string;
    expect(selectedColumns).not.toContain("lost_reason_notes");
    expect(selectedColumns).not.toContain("created_by");
    expect(selectedColumns).not.toContain("public_email");
  });

  it("uses narrow CAS payloads for every pipeline mutation intention", async () => {
    const version = row.updated_at;
    const scenarios = [
      {
        run: (repository: SupabaseOpportunityRepository) =>
          repository.changePipelineStage({
            opportunityId,
            expectedUpdatedAt: version,
            pipelineStage: "discussion",
          }),
        patch: { pipeline_stage: "discussion" },
      },
      {
        run: (repository: SupabaseOpportunityRepository) =>
          repository.assignOwner({
            opportunityId,
            expectedUpdatedAt: version,
            ownerId: leadId,
          }),
        patch: { owner_id: leadId },
      },
      {
        run: (repository: SupabaseOpportunityRepository) =>
          repository.setExpectedCloseDate({
            opportunityId,
            expectedUpdatedAt: version,
            expectedCloseDate: "2026-08-15",
          }),
        patch: { expected_close_date: "2026-08-15" },
      },
      {
        run: (repository: SupabaseOpportunityRepository) =>
          repository.overrideProbability({
            opportunityId,
            expectedUpdatedAt: version,
            probabilityPercent: 73,
          }),
        patch: {
          probability_percent: 73,
          probability_overridden: true,
        },
      },
      {
        run: (repository: SupabaseOpportunityRepository) =>
          repository.clearProbabilityOverride({
            opportunityId,
            expectedUpdatedAt: version,
          }),
        patch: { probability_overridden: false },
      },
      {
        run: (repository: SupabaseOpportunityRepository) =>
          repository.markWon({
            opportunityId,
            expectedUpdatedAt: version,
          }),
        patch: { pipeline_stage: "won" },
      },
      {
        run: (repository: SupabaseOpportunityRepository) =>
          repository.markLost({
            opportunityId,
            expectedUpdatedAt: version,
            lostReason: "budget",
            lostReasonNotes: null,
          }),
        patch: {
          pipeline_stage: "lost",
          lost_reason: "budget",
          lost_reason_notes: null,
        },
      },
    ];

    for (const scenario of scenarios) {
      const { repository, calls } = setup([{ data: row, error: null }]);
      await expect(scenario.run(repository)).resolves.toMatchObject({
        id: opportunityId,
      });
      expect(calls.find(({ method }) => method === "update")).toEqual({
        method: "update",
        args: [scenario.patch],
      });
      expect(calls).toContainEqual({
        method: "eq",
        args: ["id", opportunityId],
      });
      expect(calls).toContainEqual({
        method: "eq",
        args: ["updated_at", version],
      });
    }
  });

  it("returns a safe empty CAS result when the expected version loses", async () => {
    const { repository } = setup([{ data: null, error: null }]);
    await expect(
      repository.changePipelineStage({
        opportunityId,
        expectedUpdatedAt: row.updated_at,
        pipelineStage: "discussion",
      }),
    ).resolves.toBeNull();
  });

  it.each([
    ["opportunity_terminal", "terminal"],
    ["opportunity_owner_forbidden", "owner_forbidden"],
    ["opportunity_owner_inactive", "owner_inactive"],
    ["opportunity_probability_forbidden", "probability_forbidden"],
    ["opportunity_probability_invalid", "probability_invalid"],
    ["opportunity_lost_reason_required", "lost_reason_required"],
    ["opportunity_lost_notes_required", "lost_notes_required"],
  ] as const)(
    "maps database detail %s to safe failure %s",
    async (details, failure) => {
      const { repository } = setup([
        {
          data: null,
          error: {
            code: details.includes("forbidden") ? "42501" : "23514",
            details,
            message: "secret SQL and trigger details",
          },
        },
      ]);
      const error = await repository
        .markWon({
          opportunityId,
          expectedUpdatedAt: row.updated_at,
        })
        .catch((caught) => caught);
      expect(error).toBeInstanceOf(OpportunityRepositoryError);
      expect(error).toMatchObject({ failure });
      expect((error as Error).message).not.toContain("secret");
      expect((error as Error).cause).not.toHaveProperty(
        "message",
        "secret SQL and trigger details",
      );
    },
  );

  it("retrieves one typed detail projection by validated UUID", async () => {
    const { repository, calls } = setup([{ data: listRow, error: null }]);
    await expect(repository.getDetailById(opportunityId)).resolves.toEqual({
      id: opportunityId,
      leadId,
      leadTitle: "Domino's festive campaign",
      companyId: "33333333-3333-4333-8333-333333333333",
      companyName: "Domino's Malaysia",
      service: "food_review",
      estimatedValueMyr: 3500,
      quotationNumber: null,
      quotationSentAt: null,
      meetingAt: null,
      depositAmountMyr: null,
      depositReceivedAt: null,
      pipelineStage: "new",
      probabilityPercent: 20,
      probabilityOverridden: false,
      expectedCloseDate: null,
      ownerId: null,
      wonAt: null,
      lostAt: null,
      lostReason: null,
      lostReasonNotes: null,
      createdAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:00:00.000Z",
      isConversion: true,
      convertedAt: "2026-07-25T00:00:00.000Z",
    });
    expect(calls).toContainEqual({
      method: "from",
      args: ["opportunity_list_read_model"],
    });
    expect(calls).toContainEqual({ method: "eq", args: ["id", opportunityId] });
    expect(calls).toContainEqual({ method: "maybeSingle", args: [] });
  });

  it("rejects malformed detail UUID before database access", async () => {
    const { repository, calls } = setup([]);
    await expect(repository.getDetailById("guessed")).rejects.toBeDefined();
    expect(calls).toEqual([]);
  });

  it("returns null when a detail row is absent or inaccessible", async () => {
    const { repository } = setup([{ data: null, error: null }]);
    await expect(repository.getDetailById(opportunityId)).resolves.toBeNull();
  });

  it("maps detail database and projection failures safely", async () => {
    const database = setup([
      { data: null, error: { message: "secret policy and SQL" } },
    ]).repository;
    const databaseError = await database
      .getDetailById(opportunityId)
      .catch((caught) => caught);
    expect(databaseError).toBeInstanceOf(OpportunityRepositoryError);
    expect((databaseError as Error).message).not.toContain("secret");

    const projection = setup([
      { data: { ...listRow, service: "future_service" }, error: null },
    ]).repository;
    const projectionError = await projection
      .getDetailById(opportunityId)
      .catch((caught) => caught);
    expect(projectionError).toBeInstanceOf(OpportunityRepositoryError);
    expect((projectionError as Error).message).toBe(
      "Opportunity repository get detail response failed",
    );
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
        pipelineStage: "quotation_sent",
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
    expect(calls).toContainEqual({
      method: "eq",
      args: ["pipeline_stage", "quotation_sent"],
    });
    expect(calls).toContainEqual({ method: "range", args: [25, 49] });
  });

  it("loads Lead access and owner names in bounded batch reads", async () => {
    const ownerId = "44444444-4444-4444-8444-444444444444";
    const { repository, calls } = setup([
      {
        data: [{ id: leadId, created_by: ownerId, assigned_to: null }],
        error: null,
      },
      {
        data: [
          {
            id: ownerId,
            full_name: "Nur Aisyah",
            role: "sales_representative",
            is_active: true,
          },
        ],
        error: null,
      },
    ]);

    await expect(repository.listLeadAccessRows([leadId, leadId])).resolves.toEqual([
      { id: leadId, created_by: ownerId, assigned_to: null },
    ]);
    await expect(repository.listOwnerProfiles()).resolves.toEqual([
      {
        id: ownerId,
        fullName: "Nur Aisyah",
        role: "sales_representative",
        isActive: true,
      },
    ]);
    expect(calls).toContainEqual({
      method: "in",
      args: ["id", [leadId]],
    });
    expect(calls).toContainEqual({ method: "limit", args: [200] });
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
