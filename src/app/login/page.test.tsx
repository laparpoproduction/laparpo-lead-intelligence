import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApplicationModeResolution: vi.fn(),
  logConfigurationUnavailableOnce: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getApplicationModeResolution: mocks.getApplicationModeResolution,
}));
vi.mock("@/lib/configuration-log", () => ({
  logConfigurationUnavailableOnce: mocks.logConfigurationUnavailableOnce,
}));
vi.mock("./login-form", () => ({
  LoginForm: () => <form data-testid="login-form" />,
}));

import LoginPage from "./page";

describe("login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "configured",
      issues: [],
    });
  });

  it("renders the configured sign-in form", () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain("Sign in to your workspace");
    expect(html).toContain('data-testid="login-form"');
  });

  it("renders a labelled explicit demo preview without a credential form", () => {
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "demo",
      issues: [],
    });
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain("Demo preview");
    expect(html).toContain("read-only");
    expect(html).toContain("Open demo preview");
    expect(html).not.toContain('data-testid="login-form"');
  });

  it("renders only a generic unavailable state when misconfigured", () => {
    mocks.getApplicationModeResolution.mockReturnValue({
      mode: "misconfigured",
      issues: ["missing_supabase_url"],
    });
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain("The service is temporarily unavailable");
    expect(html).not.toContain("SUPABASE");
    expect(html).not.toContain("missing_supabase_url");
    expect(html).not.toContain('data-testid="login-form"');
    expect(mocks.logConfigurationUnavailableOnce).toHaveBeenCalled();
  });
});
