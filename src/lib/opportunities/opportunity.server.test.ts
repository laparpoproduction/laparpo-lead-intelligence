import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApplicationMode: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getApplicationMode: mocks.getApplicationMode,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import {
  createLeadConversionContext,
  LeadConversionAuthError,
} from "./opportunity.server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApplicationMode.mockReturnValue("configured");
  mocks.getUser.mockResolvedValue({
    data: {
      user: { id: "11111111-1111-4111-8111-111111111111" },
    },
    error: null,
  });
  mocks.single.mockResolvedValue({
    data: { role: "sales_representative", is_active: true },
    error: null,
  });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mocks.single,
  };
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: vi.fn().mockReturnValue(query),
  });
});

describe("Lead conversion server context", () => {
  it("derives actor identity from authenticated context", async () => {
    await expect(createLeadConversionContext()).resolves.toMatchObject({
      actor: {
        userId: "11111111-1111-4111-8111-111111111111",
        role: "sales_representative",
        isActive: true,
      },
    });
  });

  it("rejects inactive profiles before exposing the service", async () => {
    mocks.single.mockResolvedValueOnce({
      data: { role: "sales_representative", is_active: false },
      error: null,
    });
    await expect(createLeadConversionContext()).rejects.toEqual(
      new LeadConversionAuthError("inactive"),
    );
  });

  it.each(["demo", "misconfigured"])(
    "does not create conversion or pipeline authority in %s mode",
    async (mode) => {
      mocks.getApplicationMode.mockReturnValue(mode);
      await expect(createLeadConversionContext()).rejects.toEqual(
        new LeadConversionAuthError("unavailable"),
      );
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );
});
