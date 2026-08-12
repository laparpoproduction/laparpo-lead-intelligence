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

  it.each([
    [
      { allowed: true, retry_after_ms: 0 },
      { allowed: true, retryAfterMs: 0 },
    ],
    [
      { allowed: false, retry_after_ms: 1 },
      { allowed: false, retryAfterMs: 1 },
    ],
    [
      { allowed: false, retry_after_ms: 60_000 },
      { allowed: false, retryAfterMs: 60_000 },
    ],
  ])("accepts an exact semantic RPC result %#", async (data, expected) => {
    const client = clientResult(data);
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(consumeAiActorRateLimit()).resolves.toEqual(expected);
    expect(client.rpc).toHaveBeenCalledWith("consume_ai_actor_rate_limit");
  });

  it.each([
    { allowed: true, retry_after_ms: 5_000 },
    { allowed: false, retry_after_ms: 0 },
    { allowed: true, retry_after_ms: 1 },
    { allowed: false, retry_after_ms: -1 },
    { allowed: false, retry_after_ms: 60_001 },
    { allowed: false, retry_after_ms: 1.5 },
    { allowed: "true", retry_after_ms: 0 },
    { allowed: true },
    { retry_after_ms: 0 },
    null,
    [],
    { allowed: true, retry_after_ms: 0, unexpected: "field" },
    { allowed: true, retry_after_ms: 0, constructor: "x" },
    { allowed: true, retry_after_ms: 0, prototype: "x" },
    JSON.parse(
      '{"allowed":true,"retry_after_ms":0,"__proto__":{"polluted":true}}',
    ),
    { allowed: false, retry_after_ms: 5_000, actor_id: crypto.randomUUID() },
    { allowed: true, retry_after_ms: 0, bucket: "phase-1a" },
    { allowed: true, retry_after_ms: 0, retryAfterMs: 0 },
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

  it("rejects non-JSON object structure without invoking accessors", async () => {
    const allowedGetter = vi.fn(() => true);
    const retryGetter = vi.fn(() => 0);
    const accessorResult = Object.create(null, {
      allowed: { enumerable: true, get: allowedGetter },
      retry_after_ms: { enumerable: true, get: retryGetter },
    });
    const inheritedResult = Object.create({ allowed: true });
    Object.defineProperty(inheritedResult, "retry_after_ms", { value: 0 });
    const nonStandardPrototype = Object.assign(Object.create({ marker: true }), {
      allowed: true,
      retry_after_ms: 0,
    });
    const nonEnumerableExtra = { allowed: true, retry_after_ms: 0 };
    Object.defineProperty(nonEnumerableExtra, "hidden", { value: true });
    const symbolExtra = { allowed: true, retry_after_ms: 0 };
    Object.defineProperty(symbolExtra, Symbol("hidden"), { value: true });

    for (const data of [
      accessorResult,
      inheritedResult,
      nonStandardPrototype,
      nonEnumerableExtra,
      symbolExtra,
    ]) {
      vi.mocked(createClient).mockResolvedValueOnce(clientResult(data) as never);
      await expect(consumeAiActorRateLimit()).rejects.toBeInstanceOf(
        AiActorRateLimitUnavailableError,
      );
    }
    expect(allowedGetter).not.toHaveBeenCalled();
    expect(retryGetter).not.toHaveBeenCalled();
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
});
