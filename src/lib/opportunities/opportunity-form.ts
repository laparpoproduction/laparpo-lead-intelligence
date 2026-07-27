import { z } from "zod";
import { opportunityServiceValues } from "./opportunity.types";
import {
  validateOpportunityExpectedCloseMutation,
  validateOpportunityLostMutation,
  validateOpportunityMutationVersion,
  validateOpportunityOwnerMutation,
  validateOpportunityProbabilityMutation,
  validateOpportunityStageMutation,
} from "./opportunity.validation";

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

function valueOrNull(value: FormDataEntryValue | null): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function mutationBase(formData: FormData) {
  return {
    opportunityId: formData.get("opportunityId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  };
}

export function parseOpportunityStageMutationForm(formData: FormData) {
  return validateOpportunityStageMutation({
    ...mutationBase(formData),
    pipelineStage: formData.get("pipelineStage"),
  });
}

export function parseOpportunityOwnerMutationForm(formData: FormData) {
  return validateOpportunityOwnerMutation({
    ...mutationBase(formData),
    ownerId: valueOrNull(formData.get("ownerId")),
  });
}

export function parseOpportunityExpectedCloseMutationForm(
  formData: FormData,
) {
  return validateOpportunityExpectedCloseMutation({
    ...mutationBase(formData),
    expectedCloseDate: valueOrNull(formData.get("expectedCloseDate")),
  });
}

export function parseOpportunityProbabilityMutationForm(formData: FormData) {
  const rawProbability = formData.get("probabilityPercent");
  return validateOpportunityProbabilityMutation({
    ...mutationBase(formData),
    probabilityPercent:
      typeof rawProbability === "string" && rawProbability.trim() !== ""
        ? Number(rawProbability)
        : rawProbability,
  });
}

export function parseOpportunityVersionedMutationForm(formData: FormData) {
  return validateOpportunityMutationVersion(mutationBase(formData));
}

export function parseOpportunityLostMutationForm(formData: FormData) {
  return validateOpportunityLostMutation({
    ...mutationBase(formData),
    lostReason: formData.get("lostReason"),
    lostReasonNotes: valueOrNull(formData.get("lostReasonNotes")),
  });
}
