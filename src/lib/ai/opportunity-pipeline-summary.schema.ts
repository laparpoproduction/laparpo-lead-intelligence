import { z } from "zod";
import {
  pipelineSummaryFocusCodeValues,
  pipelineSummaryOverviewCodeValues,
} from "./opportunity-pipeline-summary.types";

export const PIPELINE_SUMMARY_OUTPUT_BOUNDS = {
  focusAreas: 3,
  opportunityIdsPerFocus: 5,
} as const;

export const pipelineSummarySchema = z
  .object({
    overviewCode: z.enum(pipelineSummaryOverviewCodeValues),
    focusAreas: z
      .array(
        z
          .object({
            code: z.enum(pipelineSummaryFocusCodeValues),
            opportunityIds: z
              .array(z.uuid())
              .min(1)
              .max(PIPELINE_SUMMARY_OUTPUT_BOUNDS.opportunityIdsPerFocus),
          })
          .strict(),
      )
      .max(PIPELINE_SUMMARY_OUTPUT_BOUNDS.focusAreas),
  })
  .strict();
