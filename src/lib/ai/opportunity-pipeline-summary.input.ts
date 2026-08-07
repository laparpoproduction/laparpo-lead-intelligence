import { z } from "zod";
import {
  OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT,
  opportunityActivePipelineStageValues,
  opportunityPipelineStageValues,
  opportunityServiceValues,
} from "@/lib/opportunities/opportunity.types";
import {
  pipelineSummaryFocusCodeValues,
  pipelineSummaryOwnerStatusValues,
  type PipelineSummaryProviderSnapshot,
} from "./opportunity-pipeline-summary.types";

export const PIPELINE_SUMMARY_MAX_INPUT_BYTES = 32 * 1_024;

const providerOpportunitySchema = z
  .object({
    opportunityId: z.uuid(),
    pipelineStage: z.enum(opportunityActivePipelineStageValues),
    service: z.enum(opportunityServiceValues),
    estimatedValueMyr: z.number().min(0).max(9_999_999_999.99).nullable(),
    probabilityPercent: z.number().int().min(0).max(100),
    probabilityOverridden: z.boolean(),
    expectedCloseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .nullable(),
    ownerStatus: z.enum(pipelineSummaryOwnerStatusValues),
    daysSinceUpdated: z.number().int().min(0).max(365_000),
    opportunityKind: z.enum(["conversion", "ordinary"]),
    quotationRecorded: z.boolean(),
    meetingRecorded: z.boolean(),
    depositRecorded: z.boolean(),
    overdueExpectedClose: z.boolean(),
    attentionCodes: z.array(z.enum(pipelineSummaryFocusCodeValues)).max(7),
  })
  .strict();

export const pipelineSummaryProviderInputSchema = z
  .object({
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    activeOpportunityCount: z.number().int().min(0),
    analyzedCandidateCount: z
      .number()
      .int()
      .min(0)
      .max(OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT),
    candidateLimit: z.literal(OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT),
    stageCounts: z
      .object(
        Object.fromEntries(
          opportunityPipelineStageValues.map((stage) => [
            stage,
            z.number().int().min(0),
          ]),
        ) as Record<
          (typeof opportunityPipelineStageValues)[number],
          z.ZodNumber
        >,
      )
      .strict(),
    opportunities: z
      .array(providerOpportunitySchema)
      .max(OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.analyzedCandidateCount !== snapshot.opportunities.length) {
      context.addIssue({
        code: "custom",
        message: "Candidate count does not match the bounded snapshot",
      });
    }
    const ids = snapshot.opportunities.map((row) => row.opportunityId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Snapshot contains duplicate Opportunity IDs",
      });
    }
  });

export class PipelineSummaryInputTooLargeError extends Error {
  constructor(
    readonly actualBytes: number,
    readonly limitBytes = PIPELINE_SUMMARY_MAX_INPUT_BYTES,
  ) {
    super("Opportunity pipeline summary input exceeds the safe byte limit");
    this.name = "PipelineSummaryInputTooLargeError";
  }
}

export function serializePipelineSummaryInput(
  snapshot: PipelineSummaryProviderSnapshot,
): string {
  const validated = pipelineSummaryProviderInputSchema.parse(snapshot);
  const serialized = JSON.stringify(validated);
  const actualBytes = Buffer.byteLength(serialized, "utf8");
  if (actualBytes > PIPELINE_SUMMARY_MAX_INPUT_BYTES) {
    throw new PipelineSummaryInputTooLargeError(actualBytes);
  }
  return serialized;
}
