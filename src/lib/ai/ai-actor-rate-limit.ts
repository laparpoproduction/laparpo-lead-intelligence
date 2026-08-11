import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const aiActorRateLimitResultSchema = z
  .object({
    allowed: z.boolean(),
    retry_after_ms: z.number().int().min(0).max(60_000),
  })
  .strict();

export type AiActorRateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

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
    return {
      allowed: parsed.allowed,
      retryAfterMs: parsed.retry_after_ms,
    };
  } catch (error) {
    throw new AiActorRateLimitUnavailableError(error);
  }
}
