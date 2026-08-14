import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CompanyIntelligenceService } from "@/lib/ai/company-intelligence.service";
import {
  deriveOpenAiSafetyIdentifier,
  getAiControlConfiguration,
} from "@/lib/ai/ai-control";
import { CompanyIntelligenceInputTooLargeError } from "@/lib/ai/company-intelligence.input";
import {
  CompanyNotFoundError,
  CompanyPermissionError,
  type CompanyService,
} from "@/lib/companies/company.service";
import {
  CompanyMutationAuthError,
  createCompanyMutationContext,
} from "@/lib/companies/company.server";
import {
  companyFixture,
  companyId,
  userId,
} from "@/lib/companies/company.test-fixtures";
import { getApplicationMode } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createCompanyIntelligenceService } from "@/lib/ai/company-intelligence.server";
import { createClient } from "@/lib/supabase/server";
import {
  companyIntelligenceEvaluationFixtures,
  validCompanyIntelligence,
} from "@/lib/ai/company-intelligence.test-fixtures";
import { generateCompanyIntelligenceAction } from "./intelligence-actions";
import { initialCompanyIntelligenceActionState } from "./intelligence-state";

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, getApplicationMode: vi.fn() };
});
vi.mock("@/lib/companies/company.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/companies/company.server")>();
  return { ...actual, createCompanyMutationContext: vi.fn() };
});
vi.mock("@/lib/ai/company-intelligence.server", () => ({
  createCompanyIntelligenceService: vi.fn(),
}));
vi.mock("@/lib/ai/ai-control", () => ({
  deriveOpenAiSafetyIdentifier: vi.fn(),
  getAiControlConfiguration: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const actor = {
  userId,
  role: "sales_manager" as const,
  isActive: true,
};
const getById = vi.fn();
const generate = vi.fn();

function limiterClient(data: unknown, error: unknown = null) {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) };
}

function form(id = companyId): FormData {
  const value = new FormData();
  value.set("companyId", id);
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getApplicationMode).mockReturnValue("configured");
  vi.mocked(getAiControlConfiguration).mockReturnValue({
    status: "enabled",
    providerKind: "openai",
    model: "gpt-5.6-terra",
    identitySecret: "identity-secret-that-is-at-least-32-bytes",
    openAiApiKey: "unit-test-key",
  });
  vi.mocked(deriveOpenAiSafetyIdentifier).mockReturnValue(
    "lai-ai-v1_unit-test-safety-identifier",
  );
  getById.mockResolvedValue(companyFixture);
  vi.mocked(createCompanyMutationContext).mockResolvedValue({
    actor,
    service: { getById } as unknown as CompanyService,
  });
  generate.mockResolvedValue({
    intelligence: validCompanyIntelligence,
    model: "gpt-5.6-terra",
    usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
  });
  vi.mocked(createCompanyIntelligenceService).mockReturnValue({
    generate,
  } as unknown as CompanyIntelligenceService);
  vi.mocked(createClient).mockResolvedValue(
    limiterClient({ allowed: true, retry_after_ms: 0 }) as never,
  );
});

describe("Generate Company intelligence action", () => {
  it("blocks direct invocation server-side before limiter, projection or provider when disabled", async () => {
    vi.mocked(getAiControlConfiguration).mockReturnValueOnce({ status: "disabled" });
    await expect(
      generateCompanyIntelligenceAction(
        initialCompanyIntelligenceActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status: "ai_disabled" });
    expect(createClient).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
    expect(createCompanyIntelligenceService).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("retrieves the target server-side under existing authorization and sends only the GREEN projection", async () => {
    const submitted = form();
    submitted.set("displayName", "client-controlled-company");
    submitted.set("publicEmail", "forbidden-email-sentinel@example.test");
    submitted.set("role", "ceo_admin");
    submitted.set("OPENAI_API_KEY", "forbidden-key-sentinel");

    const state = await generateCompanyIntelligenceAction(
      initialCompanyIntelligenceActionState,
      submitted,
    );

    expect(state).toMatchObject({
      status: "success",
      intelligence: validCompanyIntelligence,
    });
    expect(getById).toHaveBeenCalledWith(companyId, actor);
    expect(deriveOpenAiSafetyIdentifier).toHaveBeenCalledWith(
      actor.userId,
      "identity-secret-that-is-at-least-32-bytes",
    );
    expect(createCompanyIntelligenceService).toHaveBeenCalledWith(
      expect.objectContaining({ status: "enabled", providerKind: "openai" }),
      "lai-ai-v1_unit-test-safety-identifier",
    );
    expect(generate).toHaveBeenCalledWith(
      companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
    );
    const serializedProjection = JSON.stringify(generate.mock.calls[0]?.[0]);
    expect(serializedProjection).not.toContain("client-controlled-company");
    expect(serializedProjection).not.toContain(
      "forbidden-email-sentinel@example.test",
    );
    expect(serializedProjection).not.toContain("forbidden-key-sentinel");
    expect(JSON.stringify(state)).not.toContain("fnb_business_profile");
    expect(JSON.stringify(state)).not.toContain("websiteUrl");
  });

  it("does not call the provider for demo or misconfigured modes", async () => {
    for (const mode of ["demo", "misconfigured"] as const) {
      vi.mocked(getApplicationMode).mockReturnValueOnce(mode);
      await expect(
        generateCompanyIntelligenceAction(
          initialCompanyIntelligenceActionState,
          form(),
        ),
      ).resolves.toMatchObject({ status: "ai_not_configured" });
    }

    expect(createCompanyMutationContext).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("denies unauthenticated and inactive actors before Company retrieval", async () => {
    vi.mocked(createCompanyMutationContext)
      .mockRejectedValueOnce(new CompanyMutationAuthError("unauthenticated"))
      .mockRejectedValueOnce(new CompanyMutationAuthError("inactive"));

    await expect(
      generateCompanyIntelligenceAction(
        initialCompanyIntelligenceActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status: "permission_error" });
    await expect(
      generateCompanyIntelligenceAction(
        initialCompanyIntelligenceActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status: "permission_error" });
    expect(getById).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    new CompanyPermissionError(),
    new CompanyNotFoundError(),
  ])("uses non-enumerating behavior for inaccessible Companies", async (error) => {
    getById.mockRejectedValueOnce(error);

    const state = await generateCompanyIntelligenceAction(
      initialCompanyIntelligenceActionState,
      form(),
    );
    expect(state).toMatchObject({
      status: "not_found",
      message: "Company intelligence is unavailable for this record.",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("fails safely when AI is not configured or the distributed limiter rejects the actor", async () => {
    vi.mocked(getAiControlConfiguration).mockReturnValueOnce({ status: "invalid" });
    await expect(
      generateCompanyIntelligenceAction(
        initialCompanyIntelligenceActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status: "ai_not_configured" });
    expect(createClient).not.toHaveBeenCalled();

    vi.mocked(createClient).mockResolvedValueOnce(
      limiterClient({ allowed: false, retry_after_ms: 5_000 }) as never,
    );
    await expect(
      generateCompanyIntelligenceAction(
        initialCompanyIntelligenceActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status: "rate_limited" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("fails closed before provider input or invocation when limiter storage is unavailable", async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      limiterClient(null, { message: "private database detail" }) as never,
    );
    await expect(
      generateCompanyIntelligenceAction(
        initialCompanyIntelligenceActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status: "provider_unavailable" });
    expect(getById).not.toHaveBeenCalled();
    expect(createCompanyIntelligenceService).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    { allowed: true, retry_after_ms: 5_000 },
    { allowed: false, retry_after_ms: 0 },
    { allowed: true, retry_after_ms: 0, constructor: "x" },
    { allowed: true, retry_after_ms: 0, prototype: "x" },
    JSON.parse(
      '{"allowed":true,"retry_after_ms":0,"__proto__":{"polluted":true}}',
    ),
  ])(
    "fails closed before Phase 1A provider work for malformed limiter output %#",
    async (data) => {
      vi.mocked(createClient).mockResolvedValueOnce(
        limiterClient(data) as never,
      );

      await expect(
        generateCompanyIntelligenceAction(
          initialCompanyIntelligenceActionState,
          form(),
        ),
      ).resolves.toMatchObject({ status: "provider_unavailable" });
      expect(getById).not.toHaveBeenCalled();
      expect(createCompanyIntelligenceService).not.toHaveBeenCalled();
      expect(generate).not.toHaveBeenCalled();
    },
  );

  it("never exposes raw provider errors, prompts, or secrets in client state or logs", async () => {
    generate.mockRejectedValueOnce(
      new Error("raw-provider-secret OPENAI_API_KEY=sk-sensitive"),
    );

    const state = await generateCompanyIntelligenceAction(
      initialCompanyIntelligenceActionState,
      form(),
    );
    expect(state).toEqual({
      status: "unexpected",
      message: "Company intelligence could not be generated.",
    });

    const serializedLogs = JSON.stringify([
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
    ]);
    expect(serializedLogs).not.toContain("sk-sensitive");
    expect(serializedLogs).not.toContain("raw-provider-secret");
    expect(serializedLogs).not.toContain("lai-ai-v1_unit-test-safety-identifier");
    expect(serializedLogs).not.toContain("identity-secret-that-is-at-least-32-bytes");
    expect(serializedLogs).not.toContain(JSON.stringify(companyFixture));
  });

  it("does not refund a consumed slot after provider failure", async () => {
    generate.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(
      generateCompanyIntelligenceAction(
        initialCompanyIntelligenceActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status: "unexpected" });

    vi.mocked(createClient).mockResolvedValueOnce(
      limiterClient({ allowed: false, retry_after_ms: 5_000 }) as never,
    );
    await expect(
      generateCompanyIntelligenceAction(
        initialCompanyIntelligenceActionState,
        form(),
      ),
    ).resolves.toMatchObject({ status: "rate_limited" });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("returns a safe oversized-input error and logs only size metadata", async () => {
    const oversizedSentinel = "oversized-sensitive-company-description";
    getById.mockResolvedValueOnce({
      ...companyFixture,
      description: oversizedSentinel.repeat(100),
    });
    generate.mockRejectedValueOnce(
      new CompanyIntelligenceInputTooLargeError("description", 2_100, 2_000),
    );

    const state = await generateCompanyIntelligenceAction(
      initialCompanyIntelligenceActionState,
      form(),
    );

    expect(state).toEqual({
      status: "validation_error",
      message:
        "The available Company metadata exceeds the safe AI input limit.",
    });
    const serializedLogs = JSON.stringify([
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
    ]);
    expect(serializedLogs).toContain('"limitCategory":"description"');
    expect(serializedLogs).toContain('"actualSize":2100');
    expect(serializedLogs).not.toContain(oversizedSentinel);
    expect(serializedLogs).not.toContain("oversized-sensitive");
  });

  it("rejects invalid target IDs without a provider call", async () => {
    await expect(
      generateCompanyIntelligenceAction(
        initialCompanyIntelligenceActionState,
        form("not-a-uuid"),
      ),
    ).resolves.toMatchObject({ status: "not_found" });
    expect(getById).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
});
