import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getApplicationModeResolution: vi.fn(),
  getPublicEnv: vi.fn(),
  getUser: vi.fn(),
  logConfigurationUnavailableOnce: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/lib/configuration-log", () => ({
  logConfigurationUnavailableOnce: mocks.logConfigurationUnavailableOnce,
}));
vi.mock("@/lib/env", () => ({
  getApplicationModeResolution: mocks.getApplicationModeResolution,
  getPublicEnv: mocks.getPublicEnv,
  SERVICE_UNAVAILABLE_PATH: "/service-unavailable",
}));

import { updateSession } from "./proxy";

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("session proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "configured",
      issues: [],
    });
    mocks.getPublicEnv.mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } } });
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    });
  });

  it("passes a configured authenticated protected request", async () => {
    const response = await updateSession(request("/opportunities"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects a configured unauthenticated protected request to login", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    const response = await updateSession(request("/companies"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login",
    );
  });

  it("redirects a configured authenticated login request to the dashboard", async () => {
    const response = await updateSession(request("/login"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("deliberately passes explicit non-production demo requests", async () => {
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "demo",
      issues: [],
    });
    const dashboard = await updateSession(request("/opportunities/pipeline"));
    const login = await updateSession(request("/login"));
    expect(dashboard.headers.get("x-middleware-next")).toBe("1");
    expect(login.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it.each([
    ["production missing configuration", ["missing_supabase_configuration"]],
    ["partial configuration", ["missing_supabase_publishable_key"]],
    ["production demo flag", ["production_demo_forbidden"]],
  ])("blocks protected routes for %s", async (_label, issues) => {
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "misconfigured",
      issues,
    });
    const response = await updateSession(request("/leads"));
    expect(response.status).toBe(503);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost/service-unavailable",
    );
    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it.each([
    "/companies/11111111-1111-4111-8111-111111111111.svg?tab=activity",
    "/opportunities/pipeline.png?download=1",
    "/leads/private.webp",
  ])(
    "blocks an image-suffixed protected route while misconfigured: %s",
    async (path) => {
      mocks.getApplicationModeResolution.mockReturnValue({
        mode: "misconfigured",
        issues: ["missing_supabase_configuration"],
      });
      const response = await updateSession(request(path));
      expect(response.status).toBe(503);
      expect(response.headers.get("x-middleware-rewrite")).toBe(
        "http://localhost/service-unavailable",
      );
      expect(response.headers.get("x-middleware-next")).toBeNull();
      expect(response.cookies.getAll()).toEqual([]);
      expect(mocks.createServerClient).not.toHaveBeenCalled();
    },
  );

  it("does not loop on the unavailable route or block Next.js infrastructure", async () => {
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "misconfigured",
      issues: ["missing_supabase_configuration"],
    });
    const unavailable = await updateSession(request("/service-unavailable"));
    const staticAsset = await updateSession(
      request("/_next/static/chunks/app.js"),
    );
    const image = await updateSession(request("/_next/image"));
    const favicon = await updateSession(request("/favicon.ico"));
    expect(unavailable.headers.get("x-middleware-next")).toBe("1");
    expect(staticAsset.headers.get("x-middleware-next")).toBe("1");
    expect(image.headers.get("x-middleware-next")).toBe("1");
    expect(favicon.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.logConfigurationUnavailableOnce).not.toHaveBeenCalled();
  });
});
