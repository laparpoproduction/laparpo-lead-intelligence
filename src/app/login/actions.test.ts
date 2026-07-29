import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getApplicationMode: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/env", () => ({
  getApplicationMode: mocks.getApplicationMode,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { login } from "./actions";

function validForm() {
  const form = new FormData();
  form.set("email", "sales@laparpo.com");
  form.set("password", "password123");
  return form;
}

describe("login action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationMode.mockReturnValue("configured");
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword: mocks.signInWithPassword },
    });
  });

  it("preserves configured Supabase sign-in", async () => {
    await expect(login({}, validForm())).rejects.toThrow("REDIRECT:/");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "sales@laparpo.com",
      password: "password123",
    });
  });

  it("keeps configured invalid credentials generic", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({
      error: { code: "invalid_credentials" },
    });
    await expect(login({}, validForm())).resolves.toEqual({
      error: "The email or password is incorrect.",
    });
  });

  it("returns a generic unavailable result for misconfiguration", async () => {
    mocks.getApplicationMode.mockReturnValue("misconfigured");
    await expect(login({}, validForm())).resolves.toEqual({
      error: "The service is temporarily unavailable. Please try again later.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("does not submit credentials during explicit demo preview", async () => {
    mocks.getApplicationMode.mockReturnValue("demo");
    await expect(login({}, validForm())).resolves.toEqual({
      error: "Demo preview is enabled. Sign-in is not required.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
