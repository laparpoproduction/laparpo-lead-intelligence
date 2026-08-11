import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import type { OpportunityPipelineSummaryService } from "@/lib/ai/opportunity-pipeline-summary.service";
import {
  makePipelineSummaryReadModel,
  makePipelineSummaryRow,
  pipelineActorId,
} from "@/lib/ai/opportunity-pipeline-summary.test-fixtures";
import { getApplicationMode } from "@/lib/env";
import type { LeadConversionService } from "@/lib/opportunities/opportunity.service";
import {
  createOpportunityContext,
  LeadConversionAuthError,
} from "@/lib/opportunities/opportunity.server";
import { createOpportunityPipelineSummaryService } from "@/lib/ai/opportunity-pipeline-summary.server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { generateOpportunityPipelineSummaryAction } from "./summary-action";
import { initialOpportunityPipelineSummaryActionState } from "./summary-state";

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  getApplicationMode: vi.fn(),
}));
vi.mock("@/lib/opportunities/opportunity.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities/opportunity.server")>()),
  createOpportunityContext: vi.fn(),
}));
vi.mock("@/lib/ai/opportunity-pipeline-summary.server", () => ({
  createOpportunityPipelineSummaryService: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const actor = {
  userId: pipelineActorId,
  role: "sales_representative" as const,
  isActive: true,
};
const row = makePipelineSummaryRow(1, {
  expected_close_date: "2026-08-01",
});
const readModel = makePipelineSummaryReadModel([row]);
const getPipelineSummaryReadModel = vi.fn();
const generate = vi.fn();

function limiterClient(data: unknown, error: unknown = null) {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getApplicationMode).mockReturnValue("configured");
  getPipelineSummaryReadModel.mockResolvedValue(readModel);
  vi.mocked(createOpportunityContext).mockResolvedValue({
    actor,
    service: { getPipelineSummaryReadModel } as unknown as LeadConversionService,
  });
  generate.mockResolvedValue({
    summary: {
      overview: "Trusted application overview",
      activeOpportunityCount: 1,
      analyzedCandidateCount: 1,
      candidateLimit: 75,
      focusAreas: [],
    },
    model: "gpt-5.6-terra",
    usage: null,
  });
  vi.mocked(createOpportunityPipelineSummaryService).mockReturnValue({
    generate,
  } as unknown as OpportunityPipelineSummaryService);
  vi.mocked(createClient).mockResolvedValue(
    limiterClient({ allowed: true, retry_after_ms: 0 }) as never,
  );
});

describe("Opportunity pipeline summary server action", () => {
  it("ignores browser pipeline/provider payload and builds the authorized snapshot server-side", async () => {
    const formData = new FormData();
    formData.set("actorId", "99999999-9999-4999-8999-999999999999");
    formData.set("opportunityId", "88888888-8888-4888-8888-888888888888");
    formData.set("companyName", "FORBIDDEN CLIENT PAYLOAD");
    formData.set("model", "client-selected-model");
    const state = await generateOpportunityPipelineSummaryAction(
      initialOpportunityPipelineSummaryActionState,
      formData,
    );
    expect(state.status).toBe("success");
    expect(getPipelineSummaryReadModel).toHaveBeenCalledWith(
      actor,
      expect.any(Date),
    );
    const projection = generate.mock.calls[0]?.[0];
    expect(JSON.stringify(projection.providerSnapshot)).not.toContain(
      "FORBIDDEN CLIENT PAYLOAD",
    );
    expect(JSON.stringify(projection.providerSnapshot)).not.toContain(
      "client-selected-model",
    );
  });

  it("denies demo, unauthenticated and inactive requests before any provider call", async () => {
    vi.mocked(getApplicationMode).mockReturnValueOnce("demo");
    await expect(
      generateOpportunityPipelineSummaryAction(
        initialOpportunityPipelineSummaryActionState,
        new FormData(),
      ),
    ).resolves.toMatchObject({ status: "ai_not_configured" });

    for (const code of ["unauthenticated", "inactive"] as const) {
      vi.mocked(createOpportunityContext).mockRejectedValueOnce(
        new LeadConversionAuthError(code),
      );
      await expect(
        generateOpportunityPipelineSummaryAction(
          initialOpportunityPipelineSummaryActionState,
          new FormData(),
        ),
      ).resolves.toMatchObject({ status: "permission_error" });
    }
    expect(generate).not.toHaveBeenCalled();
  });

  it("shares the distributed denial and fails closed before any pipeline/provider work", async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      limiterClient({ allowed: false, retry_after_ms: 5_000 }) as never,
    );
    await expect(
      generateOpportunityPipelineSummaryAction(
        initialOpportunityPipelineSummaryActionState,
        new FormData(),
      ),
    ).resolves.toMatchObject({ status: "rate_limited" });
    expect(getPipelineSummaryReadModel).not.toHaveBeenCalled();
    expect(createOpportunityPipelineSummaryService).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();

    vi.mocked(createClient).mockResolvedValueOnce(
      limiterClient(null, { message: "private database detail" }) as never,
    );
    await expect(
      generateOpportunityPipelineSummaryAction(
        initialOpportunityPipelineSummaryActionState,
        new FormData(),
      ),
    ).resolves.toMatchObject({ status: "provider_unavailable" });
    expect(getPipelineSummaryReadModel).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    { allowed: true, retry_after_ms: 5_000 },
    { allowed: false, retry_after_ms: 0 },
  ])(
    "fails closed before Phase 1B provider work for malformed limiter output %#",
    async (data) => {
      vi.mocked(createClient).mockResolvedValueOnce(
        limiterClient(data) as never,
      );

      await expect(
        generateOpportunityPipelineSummaryAction(
          initialOpportunityPipelineSummaryActionState,
          new FormData(),
        ),
      ).resolves.toMatchObject({ status: "provider_unavailable" });
      expect(getPipelineSummaryReadModel).not.toHaveBeenCalled();
      expect(createOpportunityPipelineSummaryService).not.toHaveBeenCalled();
      expect(generate).not.toHaveBeenCalled();
    },
  );

  it("does not expose raw provider errors or pipeline values in logs", async () => {
    generate.mockRejectedValueOnce(
      new Error("raw secret RM999999 OPENAI_API_KEY=sk-sensitive"),
    );
    const state = await generateOpportunityPipelineSummaryAction(
      initialOpportunityPipelineSummaryActionState,
      new FormData(),
    );
    expect(state).toEqual({
      status: "unexpected",
      message: "The Opportunity pipeline summary could not be generated.",
    });
    const logs = JSON.stringify([
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
    ]);
    expect(logs).not.toContain("sk-sensitive");
    expect(logs).not.toContain("RM999999");
    expect(logs).not.toContain(row.id);
  });
});
