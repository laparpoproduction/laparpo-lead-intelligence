import { describe, expect, it } from "vitest";
import { CompanyIntelligenceRateLimiter } from "./company-intelligence.rate-limit";

describe("Company intelligence in-runtime rate limiter", () => {
  it("enforces a cooldown and a bounded per-minute window per actor", () => {
    const limiter = new CompanyIntelligenceRateLimiter();
    const start = 1_000_000;

    expect(limiter.consume("actor-a", start)).toBe(true);
    expect(limiter.consume("actor-a", start + 1_000)).toBe(false);
    expect(limiter.consume("actor-b", start + 1_000)).toBe(true);

    for (const offset of [5_000, 10_000, 15_000, 20_000]) {
      expect(limiter.consume("actor-a", start + offset)).toBe(true);
    }
    expect(limiter.consume("actor-a", start + 25_000)).toBe(false);
    expect(limiter.consume("actor-a", start + 61_000)).toBe(true);
  });
});
