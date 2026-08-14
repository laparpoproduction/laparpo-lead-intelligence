import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  deriveOpenAiSafetyIdentifier,
  resolveAiControlConfiguration,
} from "./ai-control";

const actorA = "11111111-1111-4111-8111-111111111111";
const actorB = "22222222-2222-4222-8222-222222222222";
const secretA = "0123456789abcdef0123456789abcdef";
const secretB = "fedcba9876543210fedcba9876543210";

function configured(overrides: Record<string, string | undefined> = {}) {
  return resolveAiControlConfiguration({
    nodeEnv: "production",
    applicationMode: "configured",
    enabled: "true",
    identitySecret: secretA,
    openAiApiKey: "unit-test-key",
    ...overrides,
  });
}

describe("AI provider identity and control configuration", () => {
  it("is explicitly disabled without requiring provider credentials", () => {
    expect(resolveAiControlConfiguration({ nodeEnv: "production", applicationMode: "configured" })).toEqual({ status: "disabled" });
    expect(configured({ enabled: "false", identitySecret: undefined })).toEqual({ status: "disabled" });
  });

  it.each(["TRUE", "1", "yes", "on", ""])("fails closed for malformed enablement %j", (enabled) => {
    expect(configured({ enabled })).toEqual({ status: "invalid" });
  });

  it("fails closed for missing or invalid live-provider prerequisites", () => {
    expect(configured({ openAiApiKey: undefined })).toEqual({ status: "invalid" });
    expect(configured({ identitySecret: undefined })).toEqual({ status: "invalid" });
    expect(configured({ identitySecret: "short" })).toEqual({ status: "invalid" });
    expect(configured({ identitySecret: "                                " })).toEqual({ status: "invalid" });
    expect(configured({ openAiModel: "gpt-unapproved" })).toEqual({ status: "invalid" });
  });

  it("accepts only the default or existing allow-listed model", () => {
    expect(configured()).toMatchObject({ status: "enabled", model: "gpt-5.6-terra" });
    expect(configured({ openAiModel: "gpt-5.6-luna" })).toMatchObject({ status: "enabled", model: "gpt-5.6-luna" });
  });

  it("rejects deterministic provider selection in production and retains guarded test selection", () => {
    const flags = { authenticatedE2E: "true", aiStub: "true", aiStubCallsFile: `${process.cwd()}/.tmp/authenticated-e2e/ai-calls.log` };
    expect(configured(flags)).toEqual({ status: "invalid" });
    expect(resolveAiControlConfiguration({ nodeEnv: "test", applicationMode: "configured", enabled: "true", identitySecret: secretA, ...flags })).toMatchObject({ status: "enabled", providerKind: "deterministic-e2e" });
  });
});

describe("OpenAI safety identifier", () => {
  it("uses the exact full versioned HMAC and stable URL-safe encoding", () => {
    const expected = `lai-ai-v1_${createHmac("sha256", secretA).update(`openai-safety:v1:${actorA}`, "utf8").digest("base64url")}`;
    const actual = deriveOpenAiSafetyIdentifier(actorA, secretA);
    expect(actual).toBe(expected);
    expect(actual).toMatch(/^lai-ai-v1_[A-Za-z0-9_-]{43}$/);
    expect(actual.length).toBeLessThanOrEqual(64);
    expect(actual).not.toContain("=");
    expect(actual).not.toContain(actorA);
    expect(actual).not.toContain(secretA);
  });

  it("is stable across slices and separates actors, secrets and domains", () => {
    const phase1A = deriveOpenAiSafetyIdentifier(actorA, secretA);
    expect(deriveOpenAiSafetyIdentifier(actorA, secretA)).toBe(phase1A);
    expect(deriveOpenAiSafetyIdentifier(actorB, secretA)).not.toBe(phase1A);
    expect(deriveOpenAiSafetyIdentifier(actorA, secretB)).not.toBe(phase1A);
    const unversioned = createHmac("sha256", secretA).update(actorA).digest("base64url");
    expect(phase1A).not.toContain(unversioned);
  });

  it("rejects malformed or browser-invented actor identities", () => {
    expect(() => deriveOpenAiSafetyIdentifier("browser-selected", secretA)).toThrow();
    expect(() => deriveOpenAiSafetyIdentifier(actorA, "short")).toThrow("Invalid AI identity configuration");
  });
});
