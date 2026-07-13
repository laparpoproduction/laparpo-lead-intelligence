import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
  ContactMutationAuthError,
  createContactMutationContext,
} from "./contact.server";

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: vi.fn(() => true) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const userId = "11111111-1111-4111-8111-111111111111";

function clientWithProfile(
  profile: { role: string; is_active: boolean } | null,
  authUser: { id: string } | null = { id: userId },
) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(query),
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
}

describe("contact server mutation context", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("resolves actor identity, role and activity server-side", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientWithProfile({ role: "sales_manager", is_active: true }),
    );
    const context = await createContactMutationContext();
    expect(context.actor).toEqual({
      userId,
      role: "sales_manager",
      isActive: true,
    });
    expect(context.service).toBeDefined();
  });

  it("rejects unauthenticated, invalid-profile and inactive users", async () => {
    vi.mocked(createClient).mockResolvedValueOnce(
      clientWithProfile(null, null),
    );
    await expect(createContactMutationContext()).rejects.toMatchObject({
      code: "unauthenticated",
    } satisfies Partial<ContactMutationAuthError>);

    vi.mocked(createClient).mockResolvedValueOnce(
      clientWithProfile({ role: "owner", is_active: true }),
    );
    await expect(createContactMutationContext()).rejects.toMatchObject({
      code: "invalid_profile",
    } satisfies Partial<ContactMutationAuthError>);

    vi.mocked(createClient).mockResolvedValueOnce(
      clientWithProfile({ role: "sales_representative", is_active: false }),
    );
    await expect(createContactMutationContext()).rejects.toMatchObject({
      code: "inactive",
    } satisfies Partial<ContactMutationAuthError>);
  });
});
