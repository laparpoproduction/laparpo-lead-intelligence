import { appRoleSchema } from "@/lib/auth/permissions";
import { getApplicationMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { MutationRequest } from "@/lib/mutation-audit";
import { SupabaseContactRepository } from "./contact.repository";
import { ContactService } from "./contact.service";
import type { ContactActor } from "./contact.types";

export type ContactMutationAuthErrorCode =
  | "unauthenticated"
  | "inactive"
  | "invalid_profile"
  | "unavailable";

export class ContactMutationAuthError extends Error {
  constructor(readonly code: ContactMutationAuthErrorCode) {
    super(`Contact mutation authentication failed: ${code}`);
    this.name = "ContactMutationAuthError";
  }
}

export type ContactMutationContext = {
  actor: ContactActor;
  service: ContactService;
};

export async function createContactMutationContext(
  mutationRequest?: MutationRequest,
): Promise<ContactMutationContext> {
  if (getApplicationMode() !== "configured") {
    throw new ContactMutationAuthError("unavailable");
  }

  const supabase = await createClient({ mutationRequest });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new ContactMutationAuthError("unauthenticated");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", authData.user.id)
    .single();
  const role = appRoleSchema.safeParse(profile?.role);

  if (profileError || !profile || !role.success) {
    throw new ContactMutationAuthError("invalid_profile");
  }
  if (!profile.is_active) throw new ContactMutationAuthError("inactive");

  return {
    actor: {
      userId: authData.user.id,
      role: role.data,
      isActive: true,
    },
    service: new ContactService(new SupabaseContactRepository(supabase)),
  };
}
