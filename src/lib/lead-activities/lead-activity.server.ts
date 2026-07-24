import { appRoleSchema } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { SupabaseLeadRepository } from "@/lib/leads/lead.repository";
import { createClient } from "@/lib/supabase/server";
import { SupabaseLeadActivityRepository } from "./lead-activity.repository";
import { LeadActivityService } from "./lead-activity.service";
import type { LeadActivityActor } from "./lead-activity.types";

export type LeadActivityMutationAuthErrorCode =
  | "unauthenticated"
  | "inactive"
  | "invalid_profile"
  | "unavailable";

export class LeadActivityMutationAuthError extends Error {
  constructor(readonly code: LeadActivityMutationAuthErrorCode) {
    super(`Lead activity mutation authentication failed: ${code}`);
    this.name = "LeadActivityMutationAuthError";
  }
}

export type LeadActivityMutationContext = {
  actor: LeadActivityActor;
  service: LeadActivityService;
};

export async function createLeadActivityMutationContext(): Promise<LeadActivityMutationContext> {
  if (!isSupabaseConfigured()) {
    throw new LeadActivityMutationAuthError("unavailable");
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new LeadActivityMutationAuthError("unauthenticated");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", authData.user.id)
    .single();
  const role = appRoleSchema.safeParse(profile?.role);

  if (profileError || !profile || !role.success) {
    throw new LeadActivityMutationAuthError("invalid_profile");
  }
  if (!profile.is_active) {
    throw new LeadActivityMutationAuthError("inactive");
  }

  return {
    actor: {
      userId: authData.user.id,
      role: role.data,
      isActive: true,
    },
    service: new LeadActivityService(
      new SupabaseLeadActivityRepository(supabase),
      new SupabaseLeadRepository(supabase),
    ),
  };
}
