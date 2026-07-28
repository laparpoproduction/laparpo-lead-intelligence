import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
  createLeadMutationContext,
  LeadMutationAuthError,
} from "./lead.server";

const mocks = vi.hoisted(() => ({ getApplicationMode: vi.fn() }));

vi.mock("@/lib/env", () => ({
  getApplicationMode: mocks.getApplicationMode,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const userId = "11111111-1111-4111-8111-111111111111";

function clientWithProfile(profile: { role: string; is_active: boolean }) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(query),
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
}

describe("Lead server mutation context", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    mocks.getApplicationMode.mockReturnValue("configured");
  });

  it("derives the configured actor from Supabase authentication", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientWithProfile({ role: "sales_representative", is_active: true }),
    );
    await expect(createLeadMutationContext()).resolves.toMatchObject({
      actor: {
        userId,
        role: "sales_representative",
        isActive: true,
      },
    });
  });

  it.each(["demo", "misconfigured"])(
    "does not create mutation authority in %s mode",
    async (mode) => {
      mocks.getApplicationMode.mockReturnValue(mode);
      await expect(createLeadMutationContext()).rejects.toMatchObject({
        code: "unavailable",
      } satisfies Partial<LeadMutationAuthError>);
      expect(createClient).not.toHaveBeenCalled();
    },
  );
});
