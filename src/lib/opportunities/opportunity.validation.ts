import { z } from "zod";
import {
  opportunityServiceValues,
  type ConvertLeadInput,
  type ValidatedConvertLeadInput,
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
