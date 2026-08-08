import { buildPipelineSummaryRequest } from "./opportunity-pipeline-summary.prompt";
import { renderPipelineSummary } from "./opportunity-pipeline-summary.render";
import {
  assertSafePipelineSummaryJsonStructure,
  pipelineSummarySchema,
} from "./opportunity-pipeline-summary.schema";
import type {
  PipelineSummaryProjection,
  PipelineSummaryProvider,
  PipelineSummaryUsage,
  RenderedPipelineSummary,
} from "./opportunity-pipeline-summary.types";
import {
  InvalidPipelineSummaryOutputError,
  validatePipelineSummaryOutput,
} from "./opportunity-pipeline-summary.validation";
import type { CompanyIntelligenceModel } from "./company-intelligence.types";

export type GeneratePipelineSummaryResult = {
  summary: RenderedPipelineSummary;
  model: CompanyIntelligenceModel;
  usage: PipelineSummaryUsage | null;
};

export class OpportunityPipelineSummaryService {
  constructor(
    private readonly provider: PipelineSummaryProvider,
    private readonly model: CompanyIntelligenceModel,
  ) {}

  async generate(
    projection: PipelineSummaryProjection,
  ): Promise<GeneratePipelineSummaryResult> {
    const response = await this.provider.generate(
      buildPipelineSummaryRequest(projection.providerSnapshot, this.model),
    );
    try {
      assertSafePipelineSummaryJsonStructure(response.output);
    } catch {
      throw new InvalidPipelineSummaryOutputError();
    }
    const parsed = pipelineSummarySchema.safeParse(response.output);
    if (!parsed.success) throw new InvalidPipelineSummaryOutputError();
    const validated = validatePipelineSummaryOutput(projection, parsed.data);
    return {
      summary: renderPipelineSummary(projection, validated),
      model: this.model,
      usage: response.usage,
    };
  }
}
