import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { APIConnectionTimeoutError, RateLimitError } from "openai";
import { buildPipelineSummaryRequest } from "./opportunity-pipeline-summary.prompt";
import { projectOpportunityPipelineSummary } from "./opportunity-pipeline-summary.projection";
import {
  OpenAIPipelineSummaryProvider,
  PipelineSummaryProviderError,
  PipelineSummaryProviderRefusalError,
} from "./opportunity-pipeline-summary.provider";
import { InvalidPipelineSummaryOutputError } from "./opportunity-pipeline-summary.validation";
import {
  makePipelineSummaryReadModel,
  makePipelineSummaryRow,
  pipelineActorId,
} from "./opportunity-pipeline-summary.test-fixtures";

const projection = projectOpportunityPipelineSummary(
  makePipelineSummaryReadModel([
    makePipelineSummaryRow(1, { expected_close_date: "2026-08-01" }),
  ]),
  pipelineActorId,
  new Date("2026-08-07T12:00:00.000Z"),
);
const output = {
  overviewCode: "pipeline_requires_attention",
  focusAreas: [
    {
      code: "overdue_expected_close",
      opportunityIds: [makePipelineSummaryRow(1).id],
    },
  ],
};

function fakeClient(response: unknown) {
  return { responses: { parse: vi.fn().mockResolvedValue(response) } };
}

function successfulResponse(
  parsed: unknown,
  raw = JSON.stringify(parsed),
): Record<string, unknown> {
  return {
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: raw, parsed }],
      },
    ],
    output_text: raw,
    output_parsed: parsed,
    usage: { input_tokens: 70, output_tokens: 20, total_tokens: 90 },
  };
}

describe("OpenAI Opportunity pipeline summary provider", () => {
  it("uses Responses Structured Outputs with no tools, storage or model choice from the browser", async () => {
    const client = fakeClient(successfulResponse(output));
    const provider = new OpenAIPipelineSummaryProvider(
      "unit-test-key",
      client as never,
      "lai-ai-v1_pipeline-test",
    );
    const request = buildPipelineSummaryRequest(
      projection.providerSnapshot,
      "gpt-5.6-terra",
    );
    await expect(provider.generate(request)).resolves.toEqual({
      output,
      usage: { inputTokens: 70, outputTokens: 20, totalTokens: 90 },
    });
    const body = client.responses.parse.mock.calls[0]?.[0];
    expect(body).toMatchObject({
      model: "gpt-5.6-terra",
      max_output_tokens: 600,
      reasoning: { effort: "low" },
      store: false,
      safety_identifier: "lai-ai-v1_pipeline-test",
    });
    expect(body).not.toHaveProperty("tools");
    expect(body.text.format.type).toBe("json_schema");
    const schema = JSON.stringify(body.text.format);
    expect(schema).toContain("overviewCode");
    expect(schema).toContain("opportunityIds");
    expect(schema).not.toContain("confidence");
    expect(schema).not.toContain("prose");
  });

  it.each([
    ["top-level __proto__", '__proto__', false],
    ["top-level constructor", "constructor", false],
    ["top-level prototype", "prototype", false],
    ["nested __proto__", "__proto__", true],
    ["nested constructor", "constructor", true],
    ["nested prototype", "prototype", true],
  ])("rejects parsed JSON with %s before normalized output is used", async (_label, key, nested) => {
    const ordinary = JSON.stringify(output);
    const malicious = nested
      ? JSON.parse(ordinary, (name, value) =>
          name === "opportunityIds" && Array.isArray(value)
            ? value
            : value,
        )
      : JSON.parse(ordinary);
    if (nested) {
      Object.defineProperty(malicious.focusAreas[0], key, {
        configurable: true,
        enumerable: true,
        value: { polluted: true },
      });
    } else {
      Object.defineProperty(malicious, key, {
        configurable: true,
        enumerable: true,
        value: { polluted: true },
      });
    }
    const raw = JSON.stringify(malicious);
    const reparsed = JSON.parse(raw);
    expect(
      Object.getOwnPropertyNames(
        nested ? reparsed.focusAreas[0] : reparsed,
      ),
    ).toContain(key);

    const provider = new OpenAIPipelineSummaryProvider(
      "unit-test-key",
      fakeClient(successfulResponse(output, raw)) as never,
    );
    await expect(
      provider.generate(
        buildPipelineSummaryRequest(
          projection.providerSnapshot,
          "gpt-5.6-terra",
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidPipelineSummaryOutputError);
  });

  it("rejects malformed or absent raw structured output", async () => {
    const request = buildPipelineSummaryRequest(
      projection.providerSnapshot,
      "gpt-5.6-terra",
    );
    for (const raw of ['{"overviewCode":', ""]) {
      const provider = new OpenAIPipelineSummaryProvider(
        "unit-test-key",
        fakeClient(successfulResponse(output, raw)) as never,
      );
      await expect(provider.generate(request)).rejects.toBeInstanceOf(
        InvalidPipelineSummaryOutputError,
      );
    }
  });

  it("maps provider refusal, timeout and rate limits to safe errors", async () => {
    const request = buildPipelineSummaryRequest(
      projection.providerSnapshot,
      "gpt-5.6-terra",
    );
    const refusal = new OpenAIPipelineSummaryProvider(
      "unit-test-key",
      fakeClient({
        output: [{ type: "message", content: [{ type: "refusal" }] }],
        output_text: "",
        output_parsed: null,
      }) as never,
    );
    await expect(refusal.generate(request)).rejects.toBeInstanceOf(
      PipelineSummaryProviderRefusalError,
    );

    const timeoutClient = fakeClient(null);
    timeoutClient.responses.parse.mockRejectedValueOnce(
      new APIConnectionTimeoutError(),
    );
    await expect(
      new OpenAIPipelineSummaryProvider(
        "unit-test-key",
        timeoutClient as never,
      ).generate(request),
    ).rejects.toMatchObject({
      code: "timeout",
    } satisfies Partial<PipelineSummaryProviderError>);

    const rateClient = fakeClient(null);
    rateClient.responses.parse.mockRejectedValueOnce(
      new RateLimitError(429, {}, "rate limited", new Headers()),
    );
    await expect(
      new OpenAIPipelineSummaryProvider(
        "unit-test-key",
        rateClient as never,
      ).generate(request),
    ).rejects.toMatchObject({
      code: "rate_limited",
    } satisfies Partial<PipelineSummaryProviderError>);
  });
});
