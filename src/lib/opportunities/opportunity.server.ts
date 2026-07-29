import { appRoleSchema } from "@/lib/auth/permissions";
import { getApplicationMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { MutationRequest } from "@/lib/mutation-audit";
import { SupabaseOpportunityRepository } from "./opportunity.repository";
import { LeadConversionService } from "./opportunity.service";
import type { LeadConversionActor } from "./opportunity.types";

export type LeadConversionAuthErrorCode =
  | "unauthenticated"
  | "inactive"
  | "invalid_profile"
  | "unavailable";

export class LeadConversionAuthError extends Error {
  constructor(readonly code: LeadConversionAuthErrorCode) {
    super(`Lead conversion authentication failed: ${code}`);
    this.name = "LeadConversionAuthError";
  }
}

export type LeadConversionContext = {
  actor: LeadConversionActor;
  service: LeadConversionService;
};

export async function createLeadConversionContext(
  mutationRequest?: MutationRequest,
): Promise<LeadConversionContext> {
  if (getApplicationMode() !== "configured") {
    throw new LeadConversionAuthError("unavailable");
  }

  const supabase = await createClient({ mutationRequest });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new LeadConversionAuthError("unauthenticated");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", authData.user.id)
    .single();
  const role = appRoleSchema.safeParse(profile?.role);
  if (profileError || !profile || !role.success) {
    throw new LeadConversionAuthError("invalid_profile");
  }
  if (!profile.is_active) throw new LeadConversionAuthError("inactive");

  return {
    actor: {
      userId: authData.user.id,
      role: role.data,
      isActive: true,
    },
    service: new LeadConversionService(
      new SupabaseOpportunityRepository(supabase),
    ),
  };
}

export const createOpportunityContext = createLeadConversionContext;
