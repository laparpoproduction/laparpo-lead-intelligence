"use server";

import { redirect } from "next/navigation";
import { getApplicationMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function logout(): Promise<void> {
  if (getApplicationMode() !== "configured") {
    redirect("/login");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
