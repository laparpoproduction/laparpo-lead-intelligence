import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appendFile: vi.fn(),
  getApplicationMode: vi.fn(),
  getServerEnv: vi.fn(),
  openAIProvider: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ appendFile: mocks.appendFile }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  getApplicationMode: mocks.getApplicationMode,
  getServerEnv: mocks.getServerEnv,
}));
vi.mock("./opportunity-pipeline-summary.provider", () => ({
  OpenAIPipelineSummaryProvider: mocks.openAIProvider,
}));

import { DeterministicE2EPipelineSummaryProvider } from "./opportunity-pipeline-summary.e2e-provider";
import { projectOpportunityPipelineSummary } from "./opportunity-pipeline-summary.projection";
import { OpportunityPipelineSummaryService } from "./opportunity-pipeline-summary.service";
import { createOpportunityPipelineSummaryService } from "./opportunity-pipeline-summary.server";
import {
  makePipelineSummaryReadModel,
  makePipelineSummaryRow,
  pipelineActorId,
} from "./opportunity-pipeline-summary.test-fixtures";

describe("authenticated E2E Opportunity pipeline summary provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationMode.mockReturnValue("configured");
  });

  it("returns only the same closed structured contract as the real provider", async () => {
    const projection = projectOpportunityPipelineSummary(
      makePipelineSummaryReadModel([
        makePipelineSummaryRow(1, { expected_close_date: "2026-08-01" }),
      ]),
      pipelineActorId,
      new Date("2026-08-07T12:00:00.000Z"),
    );
    const service = new OpportunityPipelineSummaryService(
      new DeterministicE2EPipelineSummaryProvider(
        `${process.cwd()}/.tmp/authenticated-e2e/ai-calls.log`,
      ),
      "gpt-5.6-terra",
    );
    const generated = await service.generate(projection);
    expect(generated.summary.focusAreas[0]).toMatchObject({
      code: "overdue_expected_close",
    });
    expect(JSON.stringify(generated)).not.toContain("confidence");
    expect(mocks.appendFile).toHaveBeenCalledTimes(1);
  });

  it("selects the stub only from exact server environment flags", () => {
    mocks.getServerEnv.mockReturnValue({
      LAPARPO_AUTHENTICATED_E2E: "true",
      LAPARPO_E2E_AI_STUB: "true",
      LAPARPO_E2E_AI_STUB_CALLS_FILE: `${process.cwd()}/.tmp/authenticated-e2e/ai-calls.log`,
    });
    expect(createOpportunityPipelineSummaryService()).toBeInstanceOf(
      OpportunityPipelineSummaryService,
    );
    expect(mocks.openAIProvider).not.toHaveBeenCalled();
  });

  it("uses the real provider outside E2E and remains optional without a key", () => {
    mocks.openAIProvider.mockImplementation(function Provider() {});
    mocks.getServerEnv.mockReturnValueOnce({
      OPENAI_API_KEY: "configured-key",
      OPENAI_MODEL: "gpt-5.6-luna",
      LAPARPO_AUTHENTICATED_E2E: "false",
      LAPARPO_E2E_AI_STUB: "false",
    });
    expect(createOpportunityPipelineSummaryService()).toBeInstanceOf(
      OpportunityPipelineSummaryService,
    );
    expect(mocks.openAIProvider).toHaveBeenCalledWith("configured-key");

    mocks.getServerEnv.mockReturnValueOnce({
      LAPARPO_AUTHENTICATED_E2E: "false",
      LAPARPO_E2E_AI_STUB: "false",
    });
    expect(createOpportunityPipelineSummaryService()).toBeNull();
  });

  it.each(["demo", "misconfigured"])(
    "cannot enable either provider in %s mode",
    (mode) => {
      mocks.getApplicationMode.mockReturnValue(mode);
      mocks.getServerEnv.mockReturnValue({
        OPENAI_API_KEY: "configured-key",
        LAPARPO_AUTHENTICATED_E2E: "false",
        LAPARPO_E2E_AI_STUB: "false",
      });
      expect(createOpportunityPipelineSummaryService()).toBeNull();
      expect(mocks.openAIProvider).not.toHaveBeenCalled();
    },
  );

  it("has no request argument and rejects counters outside the disposable directory", () => {
    expect(createOpportunityPipelineSummaryService).toHaveLength(0);
    expect(
      () => new DeterministicE2EPipelineSummaryProvider("/tmp/calls.log"),
    ).toThrow("call counter path is invalid");
  });
});
