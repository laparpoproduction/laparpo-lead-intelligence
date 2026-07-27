import { z } from "zod";
import { opportunityServiceValues } from "./opportunity.types";

const maximumOpportunityValueMyr = 9_999_999_999.99;

const conversionFormSchema = z.object({
  leadId: z.uuid("Select a valid Lead."),
  service: z.enum(opportunityServiceValues, {
    message: "Select a supported Opportunity service.",
  }),
  estimatedValueMyr: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.coerce
      .number({ message: "Enter a valid MYR amount." })
      .finite("Enter a finite MYR amount.")
      .nonnegative("Estimated value cannot be negative.")
      .max(
        maximumOpportunityValueMyr,
        "Estimated value must not exceed RM9,999,999,999.99.",
      )
      .nullable(),
  ),
});

export function parseLeadConversionForm(formData: FormData) {
  return conversionFormSchema.parse({
    leadId: formData.get("leadId"),
    service: formData.get("service"),
    estimatedValueMyr: formData.get("estimatedValueMyr"),
  });
}
