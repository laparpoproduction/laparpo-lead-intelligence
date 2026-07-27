import { z } from "zod";
import {
  opportunityDefaultProbability,
  opportunityActivePipelineStageValues,
  opportunityKindValues,
  opportunityLossReasonValues,
  opportunityPipelineStageValues,
  opportunityServiceValues,
  opportunitySortValues,
  type ConvertLeadInput,
  type OpportunityListOptions,
  type OpportunityExpectedCloseMutationInput,
  type OpportunityLostMutationInput,
  type OpportunityOwnerMutationInput,
  type OpportunityProbabilityMutationInput,
  type OpportunityStageMutationInput,
  type OpportunityVersionedMutationInput,
  type OpportunityPipelineInput,
  type ValidatedConvertLeadInput,
  type ValidatedOpportunityListOptions,
  type ValidatedOpportunityPipelineInput,
} from "./opportunity.types";

const maximumOpportunityValueMyr = 9_999_999_999.99;

const conversionSchema = z.object({
  leadId: z.uuid(),
  service: z.enum(opportunityServiceValues).nullable().optional().default(null),
  estimatedValueMyr: z
    .number()
    .finite()
    .nonnegative()
    .max(maximumOpportunityValueMyr)
    .nullable()
    .optional()
    .default(null),
});

export function validateLeadConversion(
  input: ConvertLeadInput,
): ValidatedConvertLeadInput {
  return conversionSchema.parse(input);
}

export function validateOpportunityId(value: string): string {
  return z.uuid().parse(value);
}

const opportunityListSchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  service: z.enum(opportunityServiceValues).optional(),
  kind: z.enum(opportunityKindValues).default("all"),
  sort: z.enum(opportunitySortValues).default("newest"),
  page: z.number().int().positive().max(1_000_000).default(1),
  pageSize: z.number().int().positive().max(100).default(25),
});

export function validateOpportunityListOptions(
  options: OpportunityListOptions = {},
): ValidatedOpportunityListOptions {
  return opportunityListSchema.parse(options);
}

const opportunityPipelineSchema = z
  .object({
    pipelineStage: z.enum(opportunityPipelineStageValues),
    probabilityPercent: z.number().int().min(0).max(100),
    probabilityOverridden: z.boolean().default(false),
    expectedCloseDate: z.iso.date().nullable().optional().default(null),
    ownerId: z.uuid().nullable().optional().default(null),
    lostReason: z
      .enum(opportunityLossReasonValues)
      .nullable()
      .optional()
      .default(null),
    lostReasonNotes: z
      .string()
      .trim()
      .max(2_000)
      .nullable()
      .optional()
      .transform((value) => value || null),
  })
  .superRefine((value, context) => {
    const terminal = value.pipelineStage === "won" ||
      value.pipelineStage === "lost";
    if (terminal && value.probabilityOverridden) {
      context.addIssue({
        code: "custom",
        path: ["probabilityOverridden"],
        message: "Terminal probability cannot be overridden",
      });
    }
    if (
      !value.probabilityOverridden &&
      value.probabilityPercent !==
        opportunityDefaultProbability[value.pipelineStage]
    ) {
      context.addIssue({
        code: "custom",
        path: ["probabilityPercent"],
        message: "Probability must match the pipeline stage default",
      });
    }
    if (value.pipelineStage === "lost") {
      if (!value.lostReason) {
        context.addIssue({
          code: "custom",
          path: ["lostReason"],
          message: "Lost reason is required",
        });
      }
      if (value.lostReason === "other" && !value.lostReasonNotes) {
        context.addIssue({
          code: "custom",
          path: ["lostReasonNotes"],
          message: "Other Lost reason requires an explanation",
        });
      }
    } else if (value.lostReason || value.lostReasonNotes) {
      context.addIssue({
        code: "custom",
        path: ["lostReason"],
        message: "Lost reason is only valid for Lost Opportunities",
      });
    }
  });

export function validateOpportunityPipeline(
  input: OpportunityPipelineInput,
): ValidatedOpportunityPipelineInput {
  return opportunityPipelineSchema.parse(input);
}

const opportunityMutationBaseSchema = z.object({
  opportunityId: z.uuid(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

const opportunityStageMutationSchema = opportunityMutationBaseSchema.extend({
  pipelineStage: z.enum(opportunityActivePipelineStageValues),
});

const opportunityOwnerMutationSchema = opportunityMutationBaseSchema.extend({
  ownerId: z.uuid().nullable(),
});

const opportunityExpectedCloseMutationSchema =
  opportunityMutationBaseSchema.extend({
    expectedCloseDate: z.iso.date().nullable(),
  });

const opportunityProbabilityMutationSchema =
  opportunityMutationBaseSchema.extend({
    probabilityPercent: z.number().int().min(0).max(100),
  });

const opportunityLostMutationSchema = opportunityMutationBaseSchema
  .extend({
    lostReason: z.enum(opportunityLossReasonValues),
    lostReasonNotes: z
      .string()
      .trim()
      .max(2_000)
      .nullable()
      .transform((value) => value || null),
  })
  .superRefine((value, context) => {
    if (value.lostReason === "other" && !value.lostReasonNotes) {
      context.addIssue({
        code: "custom",
        path: ["lostReasonNotes"],
        message: "Other Lost reason requires an explanation",
      });
    }
  });

export function validateOpportunityMutationVersion(
  input: unknown,
): OpportunityVersionedMutationInput {
  return opportunityMutationBaseSchema.parse(input);
}

export function validateOpportunityStageMutation(
  input: unknown,
): OpportunityStageMutationInput {
  return opportunityStageMutationSchema.parse(input);
}

export function validateOpportunityOwnerMutation(
  input: unknown,
): OpportunityOwnerMutationInput {
  return opportunityOwnerMutationSchema.parse(input);
}

export function validateOpportunityExpectedCloseMutation(
  input: unknown,
): OpportunityExpectedCloseMutationInput {
  return opportunityExpectedCloseMutationSchema.parse(input);
}

export function validateOpportunityProbabilityMutation(
  input: unknown,
): OpportunityProbabilityMutationInput {
  return opportunityProbabilityMutationSchema.parse(input);
}

export function validateOpportunityLostMutation(
  input: unknown,
): OpportunityLostMutationInput {
  return opportunityLostMutationSchema.parse(input);
}
