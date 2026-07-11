import { z } from "zod";

export const leadSignalSchema = z.object({
  type: z.enum([
    "influencer_campaign",
    "active_social_content",
    "new_branch",
    "event_activity",
    "agency_partnership",
    "verified_contact",
  ]),
  confidence: z.number().min(0).max(1),
});

export type LeadSignal = z.infer<typeof leadSignalSchema>;

const weights: Record<LeadSignal["type"], number> = {
  influencer_campaign: 30,
  active_social_content: 18,
  new_branch: 20,
  event_activity: 15,
  agency_partnership: 25,
  verified_contact: 12,
};

export function calculateLeadScore(signals: readonly LeadSignal[]): number {
  const uniqueSignals = new Map<LeadSignal["type"], LeadSignal>();

  for (const rawSignal of signals) {
    const signal = leadSignalSchema.parse(rawSignal);
    const current = uniqueSignals.get(signal.type);
    if (!current || signal.confidence > current.confidence) {
      uniqueSignals.set(signal.type, signal);
    }
  }

  const score = [...uniqueSignals.values()].reduce(
    (total, signal) => total + weights[signal.type] * signal.confidence,
    0,
  );

  return Math.min(100, Math.round(score));
}

export function getLeadPriority(score: number): "high" | "low" | "medium" {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}
