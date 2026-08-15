import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { logger } from "@/lib/logger";
import {
  deriveAiOperationalActorId,
  emitAiOperationalEvent,
  type AiOperationalTelemetry,
} from "./ai-observability";

const actorA = "11111111-1111-4111-8111-111111111111";
const actorB = "22222222-2222-4222-8222-222222222222";
const secretA = "0123456789abcdef0123456789abcdef";
const secretB = "fedcba9876543210fedcba9876543210";

const safeTelemetry: AiOperationalTelemetry = {
  requestId: "33333333-3333-4333-8333-333333333333",
  actorOperationalId: deriveAiOperationalActorId(actorA, secretA),
  operation: "company_intelligence",
  model: "gpt-5.6-terra",
  providerKind: "openai",
  durationMs: 125,
  outcome: "success",
  rateLimitOutcome: "allowed",
  providerStatus: "succeeded",
  inputTokens: 100,
  outputTokens: 40,
  totalTokens: 140,
};

beforeEach(() => vi.clearAllMocks());

describe("AI operational actor identity", () => {
  it("uses the exact full versioned HMAC with unpadded base64url", () => {
    const expected = `lai-ops-v1_${createHmac("sha256", secretA)
      .update(`ai-ops:v1:${actorA}`, "utf8")
      .digest("base64url")}`;
    const actual = deriveAiOperationalActorId(actorA, secretA);
    expect(actual).toBe(expected);
    expect(actual).toMatch(/^lai-ops-v1_[A-Za-z0-9_-]{43}$/);
    expect(actual).not.toContain("=");
    expect(actual).not.toContain(actorA);
    expect(actual).not.toContain(secretA);
  });

  it("is shared across Phase 1A/1B and separates actors, secrets and domains", () => {
    const phase1A = deriveAiOperationalActorId(actorA, secretA);
    const phase1B = deriveAiOperationalActorId(actorA, secretA);
    expect(phase1B).toBe(phase1A);
    expect(deriveAiOperationalActorId(actorB, secretA)).not.toBe(phase1A);
    expect(deriveAiOperationalActorId(actorA, secretB)).not.toBe(phase1A);
    expect(
      createHmac("sha256", secretA)
        .update(`openai-safety:v1:${actorA}`, "utf8")
        .digest("base64url"),
    ).not.toBe(phase1A.replace("lai-ops-v1_", ""));
  });

  it("validates UUID identity and minimum secret size in UTF-8 bytes", () => {
    expect(() => deriveAiOperationalActorId("browser-selected", secretA)).toThrow();
    expect(() => deriveAiOperationalActorId(actorA, "界".repeat(10))).toThrow(
      "Invalid AI observability configuration",
    );
    expect(deriveAiOperationalActorId(actorA, "界".repeat(11))).toMatch(
      /^lai-ops-v1_/,
    );
    expect(() => deriveAiOperationalActorId(actorA, " ".repeat(32))).toThrow();
  });
});

describe("AI operational telemetry boundary", () => {
  it("emits only the validated primitive allow-list", () => {
    emitAiOperationalEvent("info", safeTelemetry);
    expect(logger.info).toHaveBeenCalledWith("AI operational event", safeTelemetry);
    const serialized = JSON.stringify(vi.mocked(logger.info).mock.calls);
    expect(serialized).not.toContain(actorA);
    expect(serialized).not.toContain(secretA);
    expect(serialized).not.toContain("safety_identifier");
    expect(serialized).not.toContain("OPENAI_API_KEY");
  });

  it("rejects arbitrary request/provider fields instead of redacting afterward", () => {
    emitAiOperationalEvent("error", {
      ...safeTelemetry,
      rawProviderError: "raw-provider-secret",
    } as AiOperationalTelemetry);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("does not fabricate unavailable usage values", () => {
    const withoutUsage = {
      ...safeTelemetry,
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    };
    emitAiOperationalEvent("info", withoutUsage);
    const serialized = JSON.stringify(vi.mocked(logger.info).mock.calls);
    expect(serialized).not.toContain("inputTokens");
    expect(serialized).not.toContain("outputTokens");
    expect(serialized).not.toContain("totalTokens");
    expect(serialized).not.toContain("cost");
  });

  it("swallows logger transport failures without altering control flow", () => {
    vi.mocked(logger.info).mockImplementationOnce(() => {
      throw new Error("transport failed");
    });
    expect(() => emitAiOperationalEvent("info", safeTelemetry)).not.toThrow();
  });
});
