import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyIntelligenceSchema } from "./company-intelligence.schema";
import { CompanyIntelligenceService } from "./company-intelligence.service";
import {
  companyIntelligenceEvaluationFixtures,
  validCompanyIntelligenceOutput,
} from "./company-intelligence.test-fixtures";

const mocks = vi.hoisted(() => ({
  appendFile: vi.fn(),
  getApplicationMode: vi.fn(),
  getServerEnv: vi.fn(),
  openAIProvider: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ appendFile: mocks.appendFile }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    getApplicationMode: mocks.getApplicationMode,
    getServerEnv: mocks.getServerEnv,
  };
});
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
    mocks.getApplicationMode.mockReturnValue("configured");
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
    mocks.getServerEnv.mockReturnValue({
      LAPARPO_AUTHENTICATED_E2E: "true",
      LAPARPO_E2E_AI_STUB: "true",
      LAPARPO_E2E_AI_STUB_CALLS_FILE: `${process.cwd()}/.tmp/authenticated-e2e/ai-calls.log`,
    });
    expect(createCompanyIntelligenceService()).toBeInstanceOf(
      CompanyIntelligenceService,
    );
    expect(mocks.openAIProvider).not.toHaveBeenCalled();
  });

  it("keeps the real provider for ordinary configured production", () => {
    mocks.getServerEnv.mockReturnValue({
      OPENAI_API_KEY: "configured-key",
      OPENAI_MODEL: "gpt-5.6-luna",
      LAPARPO_AUTHENTICATED_E2E: "false",
      LAPARPO_E2E_AI_STUB: "false",
    });
    mocks.openAIProvider.mockImplementation(function Provider() {});
    expect(createCompanyIntelligenceService()).toBeInstanceOf(
      CompanyIntelligenceService,
    );
    expect(mocks.openAIProvider).toHaveBeenCalledWith("configured-key");
  });

  it.each(["demo", "misconfigured"])(
    "does not create either provider in %s mode",
    (mode) => {
      mocks.getApplicationMode.mockReturnValue(mode);
      mocks.getServerEnv.mockReturnValue({
        OPENAI_API_KEY: "configured-key",
        LAPARPO_AUTHENTICATED_E2E: "false",
        LAPARPO_E2E_AI_STUB: "false",
      });
      expect(createCompanyIntelligenceService()).toBeNull();
      expect(mocks.openAIProvider).not.toHaveBeenCalled();
    },
  );

  it("cannot select provider mode from request content", () => {
    expect(createCompanyIntelligenceService).toHaveLength(0);
    expect(validCompanyIntelligenceOutput).not.toHaveProperty("providerMode");
  });

  it("rejects a call counter path outside the isolated test directory", () => {
    expect(
      () => new DeterministicE2ECompanyIntelligenceProvider("/tmp/calls.log"),
    ).toThrow("call counter path is invalid");
  });
});
