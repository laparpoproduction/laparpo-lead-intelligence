import { z } from "zod";

const urlLikePattern =
  /\b(?:(?:https?|ftp|javascript|data|file|mailto):|www\.|[a-z0-9-]+\.(?:com|net|org|my|co|io|ai)(?:\b|\/))/i;
const browsingClaimPattern =
  /\b(?:i|we)\s+(?:visited|browsed|inspected|checked|verified|opened)\s+(?:the\s+)?(?:website|url|link|page)\b/i;
const directMutationPattern =
  /\b(?:create\s+(?:this\s+)?lead|mark\s+(?:this\s+)?opportunity\s+(?:won|lost)|send\s+(?:a\s+)?whatsapp|update\s+(?:this\s+)?company)\b/i;

function boundedText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !urlLikePattern.test(value), {
      message: "AI output must not contain URLs",
    })
    .refine((value) => !browsingClaimPattern.test(value), {
      message: "AI output must not claim external browsing",
    })
    .refine((value) => !directMutationPattern.test(value), {
      message: "AI output must not direct CRM mutations",
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
