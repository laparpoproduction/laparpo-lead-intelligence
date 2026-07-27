import { z } from "zod";
import {
  opportunityKindValues,
  opportunityServiceValues,
  opportunitySortValues,
  type ConvertLeadInput,
  type OpportunityListOptions,
  type ValidatedConvertLeadInput,
  type ValidatedOpportunityListOptions,
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
