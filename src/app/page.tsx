import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return <DashboardShell demoMode userName="Laparpo" />;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const userName =
    data.user.user_metadata.full_name ?? data.user.email?.split("@")[0] ?? "Team";

  return <DashboardShell userName={userName} />;
}
