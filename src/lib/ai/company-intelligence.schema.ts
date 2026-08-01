import { z } from "zod";
import {
  businessSignalCodeValues,
  companyEvidenceFieldValues,
  companyGapFieldValues,
  profileAssessmentCodeValues,
  recommendationCodeValues,
} from "./company-intelligence.types";

export const COMPANY_INTELLIGENCE_OUTPUT_BOUNDS = {
  profileEvidenceFields: 6,
  businessSignals: 6,
  signalEvidenceFields: 3,
  dataQualityGaps: 9,
  recommendedNextSteps: 4,
  recommendationEvidenceFields: 3,
} as const;

const evidenceFieldSchema = z.enum(companyEvidenceFieldValues);

function evidenceBoundCodeSchema<T extends readonly [string, ...string[]]>(
  codes: T,
  maxEvidenceFields: number,
) {
  return z
    .object({
      code: z.enum(codes),
      evidenceFields: z.array(evidenceFieldSchema).min(1).max(maxEvidenceFields),
    })
    .strict();
}

export const companyIntelligenceSchema = z
  .object({
    profileAssessment: evidenceBoundCodeSchema(
      profileAssessmentCodeValues,
      COMPANY_INTELLIGENCE_OUTPUT_BOUNDS.profileEvidenceFields,
    ),
    businessSignals: z
      .array(
        evidenceBoundCodeSchema(
          businessSignalCodeValues,
          COMPANY_INTELLIGENCE_OUTPUT_BOUNDS.signalEvidenceFields,
        ),
      )
      .max(COMPANY_INTELLIGENCE_OUTPUT_BOUNDS.businessSignals),
    dataQualityGaps: z
      .array(z.enum(companyGapFieldValues))
      .max(COMPANY_INTELLIGENCE_OUTPUT_BOUNDS.dataQualityGaps),
    recommendedNextSteps: z
      .array(
        evidenceBoundCodeSchema(
          recommendationCodeValues,
          COMPANY_INTELLIGENCE_OUTPUT_BOUNDS.recommendationEvidenceFields,
        ),
      )
      .max(COMPANY_INTELLIGENCE_OUTPUT_BOUNDS.recommendedNextSteps),
  })
  .strict();
