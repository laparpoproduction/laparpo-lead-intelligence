import { z } from "zod";
import {
  containsDirectCrmOrContactCommand,
  containsExternalVerificationClaim,
  containsGeneratedNetworkLocation,
} from "./company-intelligence.output-safety";

function boundedText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !containsGeneratedNetworkLocation(value), {
      message: "AI output must not contain network destinations",
    })
    .refine((value) => !containsExternalVerificationClaim(value), {
      message: "AI output must not claim external browsing or verification",
    })
    .refine((value) => !containsDirectCrmOrContactCommand(value), {
      message: "AI output must not direct CRM mutations or contact",
    });
}

export const companyIntelligenceSchema = z
  .object({
    summary: boundedText(600),
    businessSignals: z.array(boundedText(180)).max(5),
    dataQualityGaps: z.array(boundedText(180)).max(5),
    recommendedNextSteps: z.array(boundedText(220)).max(5),
    confidence: z.enum(["low", "medium", "high"]),
  })
  .strict();
