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

function hasExactAiActorRateLimitShape(
  value: unknown,
): value is Record<"allowed" | "retry_after_ms", unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;

  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== 2 ||
    !ownKeys.includes("allowed") ||
    !ownKeys.includes("retry_after_ms")
  ) {
    return false;
  }

  return ["allowed", "retry_after_ms"].every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor;
  });
}

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

    if (!hasExactAiActorRateLimitShape(data)) {
      throw new TypeError("Unexpected AI actor rate-limit RPC result");
    }

    const parsed = aiActorRateLimitResultSchema.parse(data);
    return parsed.allowed
      ? { allowed: true, retryAfterMs: 0 }
      : { allowed: false, retryAfterMs: parsed.retry_after_ms };
  } catch (error) {
    throw new AiActorRateLimitUnavailableError(error);
  }
}
