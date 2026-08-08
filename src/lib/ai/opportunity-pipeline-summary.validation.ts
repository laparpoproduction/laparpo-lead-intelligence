import type {
  PipelineSummaryProjection,
  PipelineSummaryStructuredOutput,
} from "./opportunity-pipeline-summary.types";

export class InvalidPipelineSummaryOutputError extends Error {
  constructor() {
    super("Opportunity pipeline summary provider returned invalid output");
    this.name = "InvalidPipelineSummaryOutputError";
  }
}

export function validatePipelineSummaryOutput(
  projection: PipelineSummaryProjection,
  output: PipelineSummaryStructuredOutput,
): PipelineSummaryStructuredOutput {
  if (output.overviewCode !== projection.expectedOverviewCode) {
    throw new InvalidPipelineSummaryOutputError();
  }
  const focusCodes = output.focusAreas.map((focus) => focus.code);
  if (new Set(focusCodes).size !== focusCodes.length) {
    throw new InvalidPipelineSummaryOutputError();
  }
  const rows = new Map(
    projection.providerSnapshot.opportunities.map((row) => [
      row.opportunityId,
      row,
    ]),
  );

  for (const focus of output.focusAreas) {
    if (new Set(focus.opportunityIds).size !== focus.opportunityIds.length) {
      throw new InvalidPipelineSummaryOutputError();
    }
    for (const opportunityId of focus.opportunityIds) {
      const row = rows.get(opportunityId);
      if (
        !row ||
        !projection.displayById.has(opportunityId) ||
        !row.attentionCodes.includes(focus.code)
      ) {
        throw new InvalidPipelineSummaryOutputError();
      }
    }
  }
  return output;
}
