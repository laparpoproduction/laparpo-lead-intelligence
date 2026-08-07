import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getApplicationMode: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/env", () => ({
  getApplicationMode: mocks.getApplicationMode,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { logout } from "./actions";

describe("logout action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationMode.mockReturnValue("configured");
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      auth: { signOut: mocks.signOut },
    });
  });

  it("clears the real Supabase session before returning to login", async () => {
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it.each(["demo", "misconfigured"])(
    "does not invoke Supabase sign-out in %s mode",
    async (mode) => {
      mocks.getApplicationMode.mockReturnValue(mode);
      await expect(logout()).rejects.toThrow("REDIRECT:/login");
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );
});
