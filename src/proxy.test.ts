import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApplicationModeResolution: vi.fn(),
  getPublicEnv: vi.fn(),
  logConfigurationUnavailableOnce: vi.fn(),
}));

vi.mock("@/lib/configuration-log", () => ({
  logConfigurationUnavailableOnce: mocks.logConfigurationUnavailableOnce,
}));
vi.mock("@/lib/env", () => ({
  getApplicationModeResolution: mocks.getApplicationModeResolution,
  getPublicEnv: mocks.getPublicEnv,
  SERVICE_UNAVAILABLE_PATH: "/service-unavailable",
}));

import { config, proxy } from "./proxy";

function matcherApplies(url: string): boolean {
  return unstable_doesMiddlewareMatch({
    config,
    nextConfig: {},
    url: `http://localhost${url}`,
  });
}

describe("exported proxy matcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "misconfigured",
      issues: ["missing_supabase_configuration"],
    });
  });

  it.each([
    "/companies/11111111-1111-4111-8111-111111111111.svg",
    "/opportunities/pipeline.png",
    "/leads/private.webp",
    "/contacts/private.jpg",
    "/settings/private.gif",
    "/companies/example%2Esvg",
    "/leads/private.webp?download=1",
  ])("runs for protected-looking path %s", (path) => {
    expect(matcherApplies(path)).toBe(true);
  });

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/_next/image?url=%2Flogo.png&w=640&q=75",
    "/favicon.ico",
    "/service-unavailable",
  ])("skips only configuration-safe infrastructure path %s", (path) => {
    expect(matcherApplies(path)).toBe(false);
  });

  it("executes the actual proxy path and returns 503 for a matched suffix route", async () => {
    const path = "/opportunities/pipeline.png?view=kanban";
    expect(matcherApplies(path)).toBe(true);

    const response = await proxy(new NextRequest(`http://localhost${path}`));

    expect(response.status).toBe(503);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost/service-unavailable",
    );
    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(response.cookies.getAll()).toEqual([]);
  });

  it("cannot recurse if the unavailable route invokes the proxy directly", async () => {
    expect(matcherApplies("/service-unavailable")).toBe(false);

    const response = await proxy(
      new NextRequest("http://localhost/service-unavailable"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(mocks.logConfigurationUnavailableOnce).not.toHaveBeenCalled();
  });
});
