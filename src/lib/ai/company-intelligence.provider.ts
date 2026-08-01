import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { companyIntelligenceSchema } from "./company-intelligence.schema";
import type {
  CompanyIntelligenceProvider,
  CompanyIntelligenceProviderRequest,
  CompanyIntelligenceProviderResult,
} from "./company-intelligence.types";

export const COMPANY_INTELLIGENCE_TIMEOUT_MS = 20_000;
export const COMPANY_INTELLIGENCE_MAX_RETRIES = 0;

export class CompanyIntelligenceProviderError extends Error {
  constructor(readonly code: "rate_limited" | "timeout" | "unavailable") {
    super(`Company intelligence provider failed: ${code}`);
    this.name = "CompanyIntelligenceProviderError";
  }
}

export class CompanyIntelligenceProviderRefusalError extends Error {
  constructor() {
    super("Company intelligence provider refused the request");
    this.name = "CompanyIntelligenceProviderRefusalError";
  }
}

export class OpenAICompanyIntelligenceProvider
  implements CompanyIntelligenceProvider
{
  private readonly client: Pick<OpenAI, "responses">;

  constructor(apiKey: string, client?: Pick<OpenAI, "responses">) {
    this.client =
      client ??
      new OpenAI({
        apiKey,
        maxRetries: COMPANY_INTELLIGENCE_MAX_RETRIES,
        timeout: COMPANY_INTELLIGENCE_TIMEOUT_MS,
      });
  }

  async generate(
    request: CompanyIntelligenceProviderRequest,
  ): Promise<CompanyIntelligenceProviderResult> {
    try {
      const response = await this.client.responses.parse({
        model: request.model,
        input: request.input,
        max_output_tokens: request.maxOutputTokens,
        reasoning: { effort: "low" },
        store: request.store,
        text: {
          format: zodTextFormat(
            companyIntelligenceSchema,
            "company_intelligence",
          ),
        },
      });

      const refused = response.output.some(
        (item) =>
          item.type === "message" &&
          item.content.some((content) => content.type === "refusal"),
      );
      if (refused) throw new CompanyIntelligenceProviderRefusalError();

      return {
        output: response.output_parsed,
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : null,
      };
    } catch (error) {
      if (error instanceof CompanyIntelligenceProviderRefusalError) throw error;
      if (error instanceof RateLimitError) {
        throw new CompanyIntelligenceProviderError("rate_limited");
      }
      if (error instanceof APIConnectionTimeoutError) {
        throw new CompanyIntelligenceProviderError("timeout");
      }
      if (error instanceof APIConnectionError || error instanceof APIError) {
        throw new CompanyIntelligenceProviderError("unavailable");
      }
      throw error;
    }
  }
}
