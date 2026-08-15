import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyIntelligenceSchema } from "./company-intelligence.schema";
import { CompanyIntelligenceService } from "./company-intelligence.service";
import {
  companyIntelligenceEvaluationFixtures,
  validCompanyIntelligenceOutput,
} from "./company-intelligence.test-fixtures";

const mocks = vi.hoisted(() => ({
  appendFile: vi.fn(),
  openAIProvider: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ appendFile: mocks.appendFile }));
vi.mock("server-only", () => ({}));
vi.mock("./company-intelligence.provider", () => ({
  OpenAICompanyIntelligenceProvider: mocks.openAIProvider,
}));

import {
  DeterministicE2ECompanyIntelligenceProvider,
  deterministicE2ECompanyIntelligenceOutput,
} from "./company-intelligence.e2e-provider";
import { createCompanyIntelligenceService } from "./company-intelligence.server";

describe("authenticated E2E Company intelligence provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a valid closed provider result with application-derived confidence", async () => {
    expect(
      companyIntelligenceSchema.safeParse(
        deterministicE2ECompanyIntelligenceOutput,
      ).success,
    ).toBe(true);
    expect(deterministicE2ECompanyIntelligenceOutput).not.toHaveProperty(
      "confidence",
    );

    const provider = new DeterministicE2ECompanyIntelligenceProvider(
      `${process.cwd()}/.tmp/authenticated-e2e/ai-calls.log`,
    );
    const service = new CompanyIntelligenceService(
      provider,
      "gpt-5.6-terra",
    );
    await expect(
      service.generate(companyIntelligenceEvaluationFixtures.wellPopulatedFnb),
    ).resolves.toMatchObject({
      intelligence: { confidence: "medium" },
    });
    expect(mocks.appendFile).toHaveBeenCalledTimes(1);
  });

  it("selects the stub only from server environment and never requires an OpenAI key", () => {
    expect(createCompanyIntelligenceService({
      status: "enabled",
      providerKind: "deterministic-e2e",
      model: "gpt-5.6-terra",
      identitySecret: "identity-secret-that-is-at-least-32-bytes",
      observabilitySecret: "observability-secret-that-is-at-least-32-bytes",
      deterministicCallsFile: `${process.cwd()}/.tmp/authenticated-e2e/ai-calls.log`,
    }, "lai-ai-v1_test")).toBeInstanceOf(
      CompanyIntelligenceService,
    );
    expect(mocks.openAIProvider).not.toHaveBeenCalled();
  });

  it("keeps the real provider for ordinary configured production", () => {
    mocks.openAIProvider.mockImplementation(function Provider() {});
    expect(createCompanyIntelligenceService({
      status: "enabled",
      providerKind: "openai",
      model: "gpt-5.6-luna",
      identitySecret: "identity-secret-that-is-at-least-32-bytes",
      observabilitySecret: "observability-secret-that-is-at-least-32-bytes",
      openAiApiKey: "configured-key",
    }, "lai-ai-v1_test")).toBeInstanceOf(
      CompanyIntelligenceService,
    );
    expect(mocks.openAIProvider).toHaveBeenCalledWith(
      "configured-key",
      undefined,
      "lai-ai-v1_test",
    );
  });

  it("cannot select provider mode from request content", () => {
    expect(createCompanyIntelligenceService).toHaveLength(2);
    expect(validCompanyIntelligenceOutput).not.toHaveProperty("providerMode");
  });

  it("rejects a call counter path outside the isolated test directory", () => {
    expect(
      () => new DeterministicE2ECompanyIntelligenceProvider("/tmp/calls.log"),
    ).toThrow("call counter path is invalid");
  });
});
