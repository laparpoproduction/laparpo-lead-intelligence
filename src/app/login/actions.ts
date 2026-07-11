"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and a password of at least 8 characters." };
  }

  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. Add the required environment variables first." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    logger.warn("Login failed", { reason: error.code });
    return { error: "The email or password is incorrect." };
  }

  redirect("/");
}
