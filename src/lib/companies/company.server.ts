import { appRoleSchema } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { SupabaseCompanyRepository } from "./company.repository";
import { CompanyService } from "./company.service";
import type { CompanyActor } from "./company.types";

export type CompanyMutationAuthErrorCode =
  | "unauthenticated"
  | "inactive"
  | "invalid_profile"
  | "unavailable";

export class CompanyMutationAuthError extends Error {
  constructor(readonly code: CompanyMutationAuthErrorCode) {
    super(`Company mutation authentication failed: ${code}`);
    this.name = "CompanyMutationAuthError";
  }
}

export type CompanyMutationContext = {
  actor: CompanyActor;
  service: CompanyService;
};

export async function createCompanyMutationContext(): Promise<CompanyMutationContext> {
  if (!isSupabaseConfigured()) throw new CompanyMutationAuthError("unavailable");

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new CompanyMutationAuthError("unauthenticated");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", authData.user.id)
    .single();
  const role = appRoleSchema.safeParse(profile?.role);

  if (profileError || !profile || !role.success) {
    throw new CompanyMutationAuthError("invalid_profile");
  }
  if (!profile.is_active) throw new CompanyMutationAuthError("inactive");

  return {
    actor: {
      userId: authData.user.id,
      role: role.data,
      isActive: true,
    },
    service: new CompanyService(new SupabaseCompanyRepository(supabase)),
  };
}
