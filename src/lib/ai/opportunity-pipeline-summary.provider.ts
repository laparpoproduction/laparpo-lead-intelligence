import "server-only";

import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  parseRawPipelineSummaryJson,
  pipelineSummarySchema,
} from "./opportunity-pipeline-summary.schema";
import { InvalidPipelineSummaryOutputError } from "./opportunity-pipeline-summary.validation";
import type {
  PipelineSummaryProvider,
  PipelineSummaryProviderRequest,
  PipelineSummaryProviderResult,
} from "./opportunity-pipeline-summary.types";

export const PIPELINE_SUMMARY_TIMEOUT_MS = 20_000;
export const PIPELINE_SUMMARY_MAX_RETRIES = 0;

export class PipelineSummaryProviderError extends Error {
  constructor(readonly code: "rate_limited" | "timeout" | "unavailable") {
    super(`Opportunity pipeline summary provider failed: ${code}`);
    this.name = "PipelineSummaryProviderError";
  }
}

export class PipelineSummaryProviderRefusalError extends Error {
  constructor() {
    super("Opportunity pipeline summary provider refused the request");
    this.name = "PipelineSummaryProviderRefusalError";
  }
}

export class OpenAIPipelineSummaryProvider implements PipelineSummaryProvider {
  private readonly client: Pick<OpenAI, "responses">;

  constructor(
    apiKey: string,
    client?: Pick<OpenAI, "responses">,
    private readonly safetyIdentifier = "",
  ) {
    this.client =
      client ??
      new OpenAI({
        apiKey,
        maxRetries: PIPELINE_SUMMARY_MAX_RETRIES,
        timeout: PIPELINE_SUMMARY_TIMEOUT_MS,
      });
  }

  async generate(
    request: PipelineSummaryProviderRequest,
  ): Promise<PipelineSummaryProviderResult> {
    try {
      const response = await this.client.responses.parse({
        model: request.model,
        input: request.input,
        max_output_tokens: request.maxOutputTokens,
        reasoning: { effort: "low" },
        store: request.store,
        safety_identifier: this.safetyIdentifier,
        text: {
          format: zodTextFormat(
            pipelineSummarySchema,
            "opportunity_pipeline_summary",
          ),
        },
      });
      const refused = response.output.some(
        (item) =>
          item.type === "message" &&
          item.content.some((content) => content.type === "refusal"),
      );
      if (refused) throw new PipelineSummaryProviderRefusalError();
      const rawOutput = response.output_text;
      if (typeof rawOutput !== "string" || rawOutput.trim().length === 0) {
        throw new InvalidPipelineSummaryOutputError();
      }
      let parsedOutput: unknown;
      try {
        parsedOutput = parseRawPipelineSummaryJson(rawOutput);
      } catch {
        throw new InvalidPipelineSummaryOutputError();
      }
      const validatedOutput = pipelineSummarySchema.safeParse(parsedOutput);
      if (!validatedOutput.success) {
        throw new InvalidPipelineSummaryOutputError();
      }
      return {
        output: validatedOutput.data,
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : null,
      };
    } catch (error) {
      if (
        error instanceof PipelineSummaryProviderRefusalError ||
        error instanceof InvalidPipelineSummaryOutputError
      ) {
        throw error;
      }
      if (error instanceof RateLimitError) {
        throw new PipelineSummaryProviderError("rate_limited");
      }
      if (error instanceof APIConnectionTimeoutError) {
        throw new PipelineSummaryProviderError("timeout");
      }
      if (error instanceof APIConnectionError || error instanceof APIError) {
        throw new PipelineSummaryProviderError("unavailable");
      }
      throw error;
    }
  }
}
