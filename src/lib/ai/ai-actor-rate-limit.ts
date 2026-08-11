import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const aiActorRateLimitResultSchema = z.discriminatedUnion("allowed", [
  z
    .object({
      allowed: z.literal(true),
      retry_after_ms: z.literal(0),
    })
    .strict(),
  z
    .object({
      allowed: z.literal(false),
      retry_after_ms: z.number().int().min(1).max(60_000),
    })
    .strict(),
]);

export type AiActorRateLimitResult =
  | { allowed: true; retryAfterMs: 0 }
  | { allowed: false; retryAfterMs: number };

export class AiActorRateLimitUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("AI actor rate limit is unavailable", { cause });
    this.name = "AiActorRateLimitUnavailableError";
  }
}

/**
 * Consumes the one shared Phase 1A/1B actor budget. The zero-argument RPC
 * derives its identity and authoritative time inside PostgreSQL; neither is
 * accepted from browser or application input.
 */
export async function consumeAiActorRateLimit(): Promise<AiActorRateLimitResult> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("consume_ai_actor_rate_limit");
    if (error) throw error;

    const parsed = aiActorRateLimitResultSchema.parse(data);
    return parsed.allowed
      ? { allowed: true, retryAfterMs: 0 }
      : { allowed: false, retryAfterMs: parsed.retry_after_ms };
  } catch (error) {
    throw new AiActorRateLimitUnavailableError(error);
  }
}
