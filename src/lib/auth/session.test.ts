import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getApplicationModeResolution: vi.fn(),
  logConfigurationUnavailableOnce: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/configuration-log", () => ({
  logConfigurationUnavailableOnce: mocks.logConfigurationUnavailableOnce,
}));
vi.mock("@/lib/env", () => ({
  getApplicationModeResolution: mocks.getApplicationModeResolution,
  SERVICE_UNAVAILABLE_PATH: "/service-unavailable",
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { requireDashboardUser } from "./session";

const userId = "11111111-1111-4111-8111-111111111111";

function configuredClient(
  profile: {
    full_name?: string | null;
    email?: string | null;
    role: string;
    is_active: boolean;
  } | null,
  user: { id: string; email?: string } | null = {
    id: userId,
    email: "sales@laparpo.com",
  },
) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(query),
  };
}

describe("requireDashboardUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "configured",
      issues: [],
    });
  });

  it.each([
    ["production missing Supabase", ["missing_supabase_configuration"]],
    ["production demo flag", ["production_demo_forbidden"]],
    ["development without demo opt-in", ["missing_supabase_configuration"]],
  ])("fails closed for %s", async (_label, issues) => {
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "misconfigured",
      issues,
    });

    await expect(requireDashboardUser()).rejects.toThrow(
      "REDIRECT:/service-unavailable",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.logConfigurationUnavailableOnce).toHaveBeenCalled();
  });

  it("returns the labelled synthetic user only in explicit demo mode", async () => {
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "demo",
      issues: [],
    });

    await expect(requireDashboardUser()).resolves.toEqual({
      id: "demo-user",
      fullName: "Laparpo",
      email: "preview@laparpo.com",
      role: "ceo_admin",
      demoMode: true,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("redirects configured unauthenticated users to login", async () => {
    mocks.createClient.mockResolvedValue(configuredClient(null, null));
    await expect(requireDashboardUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("keeps configured inactive and invalid-profile users denied", async () => {
    mocks.createClient.mockResolvedValueOnce(
      configuredClient({ role: "sales_representative", is_active: false }),
    );
    await expect(requireDashboardUser()).rejects.toThrow(
      "REDIRECT:/login?error=inactive",
    );

    mocks.createClient.mockResolvedValueOnce(
      configuredClient({ role: "owner", is_active: true }),
    );
    await expect(requireDashboardUser()).rejects.toThrow(
      "REDIRECT:/login?error=profile",
    );
  });

  it("preserves role restrictions for configured and demo users", async () => {
    mocks.createClient.mockResolvedValue(
      configuredClient({ role: "sales_representative", is_active: true }),
    );
    await expect(
      requireDashboardUser({ allowedRoles: ["ceo_admin"] }),
    ).rejects.toThrow("REDIRECT:/?access=denied");

    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "demo",
      issues: [],
    });
    await expect(
      requireDashboardUser({ allowedRoles: ["sales_representative"] }),
    ).rejects.toThrow("REDIRECT:/?access=denied");
  });

  it("returns the authenticated configured profile without demo authority", async () => {
    mocks.createClient.mockResolvedValue(
      configuredClient({
        full_name: "Sales User",
        email: "sales@laparpo.com",
        role: "sales_manager",
        is_active: true,
      }),
    );
    await expect(requireDashboardUser()).resolves.toEqual({
      id: userId,
      fullName: "Sales User",
      email: "sales@laparpo.com",
      role: "sales_manager",
      demoMode: false,
    });
  });

  it("cannot be switched into demo by request-like caller input", async () => {
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "misconfigured",
      issues: ["missing_supabase_configuration"],
    });
    const callWithUntrustedInput = requireDashboardUser as unknown as (
      input: Record<string, unknown>,
    ) => Promise<unknown>;

    await expect(
      callWithUntrustedInput({
        query: { demoMode: "true" },
        cookies: { demoMode: "true" },
        headers: { "x-demo-mode": "true" },
      }),
    ).rejects.toThrow("REDIRECT:/service-unavailable");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
