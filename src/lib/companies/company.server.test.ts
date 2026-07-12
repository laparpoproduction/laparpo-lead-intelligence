import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
  CompanyMutationAuthError,
  createCompanyMutationContext,
} from "./company.server";

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: vi.fn(() => true) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const userId = "11111111-1111-4111-8111-111111111111";

function clientWithProfile(profile: { role: string; is_active: boolean } | null) {
  const profileResult = { data: profile, error: null };
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(profileResult),
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

describe("company server mutation context", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("resolves the actor role and activity server-side", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientWithProfile({ role: "sales_manager", is_active: true }),
    );

    const context = await createCompanyMutationContext();
    expect(context.actor).toEqual({
      userId,
      role: "sales_manager",
      isActive: true,
    });
    expect(context.service).toBeDefined();
  });

  it("rejects invalid or inactive profiles", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientWithProfile({ role: "owner", is_active: true }),
    );
    await expect(createCompanyMutationContext()).rejects.toMatchObject({
      code: "invalid_profile",
    } satisfies Partial<CompanyMutationAuthError>);

    vi.mocked(createClient).mockResolvedValue(
      clientWithProfile({ role: "sales_representative", is_active: false }),
    );
    await expect(createCompanyMutationContext()).rejects.toMatchObject({
      code: "inactive",
    } satisfies Partial<CompanyMutationAuthError>);
  });
});
