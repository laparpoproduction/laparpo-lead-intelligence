"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getApplicationMode } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const applicationMode = getApplicationMode();
  if (applicationMode === "misconfigured") {
    return {
      error: "The service is temporarily unavailable. Please try again later.",
    };
  }
  if (applicationMode === "demo") {
    return {
      error: "Demo preview is enabled. Sign-in is not required.",
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and a password of at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    logger.warn("Login failed", { reason: error.code });
    return { error: "The email or password is incorrect." };
  }

  redirect("/");
}
