import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appendFile: vi.fn(),
  openAIProvider: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ appendFile: mocks.appendFile }));
vi.mock("server-only", () => ({}));
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
    expect(createOpportunityPipelineSummaryService({
      status: "enabled",
      providerKind: "deterministic-e2e",
      model: "gpt-5.6-terra",
      identitySecret: "identity-secret-that-is-at-least-32-bytes",
      deterministicCallsFile: `${process.cwd()}/.tmp/authenticated-e2e/ai-calls.log`,
    }, "lai-ai-v1_test")).toBeInstanceOf(
      OpportunityPipelineSummaryService,
    );
    expect(mocks.openAIProvider).not.toHaveBeenCalled();
  });

  it("uses the real provider outside E2E and remains optional without a key", () => {
    mocks.openAIProvider.mockImplementation(function Provider() {});
    expect(createOpportunityPipelineSummaryService({
      status: "enabled",
      providerKind: "openai",
      model: "gpt-5.6-luna",
      identitySecret: "identity-secret-that-is-at-least-32-bytes",
      openAiApiKey: "configured-key",
    }, "lai-ai-v1_test")).toBeInstanceOf(
      OpportunityPipelineSummaryService,
    );
    expect(mocks.openAIProvider).toHaveBeenCalledWith(
      "configured-key",
      undefined,
      "lai-ai-v1_test",
    );
  });

  it("has no request argument and rejects counters outside the disposable directory", () => {
    expect(createOpportunityPipelineSummaryService).toHaveLength(2);
    expect(
      () => new DeterministicE2EPipelineSummaryProvider("/tmp/calls.log"),
    ).toThrow("call counter path is invalid");
  });
});
