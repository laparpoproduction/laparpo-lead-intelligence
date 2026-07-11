import { describe, expect, it } from "vitest";
import { canAccessPath } from "./permissions";

describe("role-based route access", () => {
  it("allows all active sales roles into operational modules", () => {
    expect(canAccessPath("sales_representative", "/leads")).toBe(true);
    expect(canAccessPath("sales_manager", "/companies")).toBe(true);
  });

  it("limits campaigns to management", () => {
    expect(canAccessPath("sales_representative", "/campaigns")).toBe(false);
    expect(canAccessPath("sales_manager", "/campaigns")).toBe(true);
  });

  it("limits settings to the CEO or admin", () => {
    expect(canAccessPath("sales_manager", "/settings")).toBe(false);
    expect(canAccessPath("ceo_admin", "/settings/team")).toBe(true);
  });
});

