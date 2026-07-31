import { describe, expect, it, vi } from "vitest";
import {
  APIConnectionTimeoutError,
  RateLimitError,
} from "openai";
import {
  CompanyIntelligenceProviderError,
  CompanyIntelligenceProviderRefusalError,
  OpenAICompanyIntelligenceProvider,
} from "./company-intelligence.provider";
import {
  DEFAULT_COMPANY_INTELLIGENCE_MODEL,
  resolveCompanyIntelligenceModel,
} from "./company-intelligence.server";
import { buildCompanyIntelligenceRequest } from "./company-intelligence.prompt";
import {
  companyIntelligenceEvaluationFixtures,
  validCompanyIntelligence,
} from "./company-intelligence.test-fixtures";

function fakeClient(response: unknown) {
  return {
    responses: {
      parse: vi.fn().mockResolvedValue(response),
    },
  };
}

describe("OpenAI Company intelligence provider", () => {
  it("allows only server-owned model choices and safely defaults unknown values", () => {
    expect(DEFAULT_COMPANY_INTELLIGENCE_MODEL).toBe("gpt-5.6-terra");
    expect(resolveCompanyIntelligenceModel("gpt-5.6-luna")).toBe(
      "gpt-5.6-luna",
    );
    expect(resolveCompanyIntelligenceModel("client-selected-model")).toBe(
      "gpt-5.6-terra",
    );
    expect(resolveCompanyIntelligenceModel(undefined)).toBe("gpt-5.6-terra");
  });

  it("uses Responses Structured Outputs with no tools, store false, bounded output, and low reasoning", async () => {
    const client = fakeClient({
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "structured", parsed: validCompanyIntelligence }],
        },
      ],
      output_parsed: validCompanyIntelligence,
      usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 },
    });
    const provider = new OpenAICompanyIntelligenceProvider(
      "unit-test-key",
      client as never,
    );
    const request = buildCompanyIntelligenceRequest(
      companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
      "gpt-5.6-terra",
    );

    await expect(provider.generate(request)).resolves.toEqual({
      output: validCompanyIntelligence,
      usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
    });
    const body = client.responses.parse.mock.calls[0]?.[0];
    expect(body).toMatchObject({
      model: "gpt-5.6-terra",
      max_output_tokens: 1_200,
      reasoning: { effort: "low" },
      store: false,
    });
    expect(body).not.toHaveProperty("tools");
    expect(body.text.format.type).toBe("json_schema");
  });

  it("rejects a provider safety refusal without exposing its text", async () => {
    const client = fakeClient({
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "raw refusal" }],
        },
      ],
      output_parsed: null,
      usage: null,
    });
    const provider = new OpenAICompanyIntelligenceProvider(
      "unit-test-key",
      client as never,
    );

    await expect(
      provider.generate(
        buildCompanyIntelligenceRequest(
          companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
          "gpt-5.6-terra",
        ),
      ),
    ).rejects.toBeInstanceOf(CompanyIntelligenceProviderRefusalError);
  });

  it("maps timeouts and rate limits to narrow safe error codes", async () => {
    const request = buildCompanyIntelligenceRequest(
      companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
      "gpt-5.6-terra",
    );
    const timeoutClient = fakeClient(null);
    timeoutClient.responses.parse.mockRejectedValueOnce(
      new APIConnectionTimeoutError(),
    );
    const timeoutProvider = new OpenAICompanyIntelligenceProvider(
      "unit-test-key",
      timeoutClient as never,
    );
    await expect(timeoutProvider.generate(request)).rejects.toMatchObject({
      code: "timeout",
    } satisfies Partial<CompanyIntelligenceProviderError>);

    const rateClient = fakeClient(null);
    rateClient.responses.parse.mockRejectedValueOnce(
      new RateLimitError(429, {}, "rate limited", new Headers()),
    );
    const rateProvider = new OpenAICompanyIntelligenceProvider(
      "unit-test-key",
      rateClient as never,
    );
    await expect(rateProvider.generate(request)).rejects.toMatchObject({
      code: "rate_limited",
    } satisfies Partial<CompanyIntelligenceProviderError>);
  });
});
