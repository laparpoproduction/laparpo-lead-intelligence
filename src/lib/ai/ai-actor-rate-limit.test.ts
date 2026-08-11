import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createClient } from "@/lib/supabase/server";
import {
  AiActorRateLimitUnavailableError,
  consumeAiActorRateLimit,
} from "./ai-actor-rate-limit";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function clientResult(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe("distributed AI actor rate limiter", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("calls the zero-business-argument RPC and accepts its strict safe result", async () => {
    const client = clientResult({ allowed: false, retry_after_ms: 4_999 });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(consumeAiActorRateLimit()).resolves.toEqual({
      allowed: false,
      retryAfterMs: 4_999,
    });
    expect(client.rpc).toHaveBeenCalledWith("consume_ai_actor_rate_limit");
  });

  it.each([
    null,
    [],
    { allowed: true },
    { allowed: "true", retry_after_ms: 0 },
    { allowed: true, retry_after_ms: -1 },
    { allowed: true, retry_after_ms: 0, actor_id: "forbidden" },
  ])("fails closed for an unexpected RPC result %#", async (data) => {
    vi.mocked(createClient).mockResolvedValue(clientResult(data) as never);
    await expect(consumeAiActorRateLimit()).rejects.toBeInstanceOf(
      AiActorRateLimitUnavailableError,
    );
  });

  it("fails closed without falling back when the RPC is unavailable", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientResult(null, { message: "private database detail" }) as never,
    );
    await expect(consumeAiActorRateLimit()).rejects.toBeInstanceOf(
      AiActorRateLimitUnavailableError,
    );
  });
});
