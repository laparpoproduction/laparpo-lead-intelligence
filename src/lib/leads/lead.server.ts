import { appRoleSchema } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { SupabaseLeadRepository } from "./lead.repository";
import { LeadService } from "./lead.service";
import type { LeadActor } from "./lead.types";

export type LeadMutationAuthErrorCode =
  | "unauthenticated"
  | "inactive"
  | "invalid_profile"
  | "unavailable";

export class LeadMutationAuthError extends Error {
  constructor(readonly code: LeadMutationAuthErrorCode) {
    super(`Lead mutation authentication failed: ${code}`);
    this.name = "LeadMutationAuthError";
  }
}

export type LeadMutationContext = {
  actor: LeadActor;
  service: LeadService;
};

export async function createLeadMutationContext(): Promise<LeadMutationContext> {
  if (!isSupabaseConfigured()) throw new LeadMutationAuthError("unavailable");

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new LeadMutationAuthError("unauthenticated");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", authData.user.id)
    .single();
  const role = appRoleSchema.safeParse(profile?.role);

  if (profileError || !profile || !role.success) {
    throw new LeadMutationAuthError("invalid_profile");
  }
  if (!profile.is_active) throw new LeadMutationAuthError("inactive");

  return {
    actor: {
      userId: authData.user.id,
      role: role.data,
      isActive: true,
    },
    service: new LeadService(new SupabaseLeadRepository(supabase)),
  };
}
