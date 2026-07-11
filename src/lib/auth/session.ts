import { redirect } from "next/navigation";
import { appRoleSchema, type AppRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type DashboardUser = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  demoMode: boolean;
};

type RequireUserOptions = {
  allowedRoles?: readonly AppRole[];
};

export async function requireDashboardUser(
  options: RequireUserOptions = {},
): Promise<DashboardUser> {
  if (!isSupabaseConfigured()) {
    return {
      id: "demo-user",
      fullName: "Laparpo",
      email: "preview@laparpo.com",
      role: "ceo_admin",
      demoMode: true,
    };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email, role, is_active")
    .eq("id", authData.user.id)
    .single();

  const parsedRole = appRoleSchema.safeParse(profile?.role);
  if (profileError || !profile || !parsedRole.success) {
    logger.error("Authenticated user has no valid profile", {
      userId: authData.user.id,
      reason: profileError?.code,
    });
    redirect("/login?error=profile");
  }

  if (!profile.is_active) {
    logger.warn("Inactive user attempted to access dashboard", {
      userId: authData.user.id,
    });
    redirect("/login?error=inactive");
  }

  if (options.allowedRoles && !options.allowedRoles.includes(parsedRole.data)) {
    logger.warn("User attempted to access a restricted route", {
      role: parsedRole.data,
      userId: authData.user.id,
    });
    redirect("/?access=denied");
  }

  return {
    id: authData.user.id,
    fullName:
      profile.full_name ?? authData.user.email?.split("@")[0] ?? "Team member",
    email: profile.email ?? authData.user.email ?? "",
    role: parsedRole.data,
    demoMode: false,
  };
}

