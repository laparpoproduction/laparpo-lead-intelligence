import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import {
  buildMutationAuditHeaders,
  type MutationRequest,
} from "@/lib/mutation-audit";

type ServerClientOptions = {
  mutationRequest?: MutationRequest;
};

export async function createClient(options: ServerClientOptions = {}) {
  const cookieStore = await cookies();
  const env = getPublicEnv();
  const mutationHeaders = options.mutationRequest
    ? buildMutationAuditHeaders(
        options.mutationRequest,
        getServerEnv().MUTATION_AUDIT_CORRELATION_SECRET,
      )
    : undefined;

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      ...(mutationHeaders
        ? {
            global: {
              headers: mutationHeaders,
            },
          }
        : {}),
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies. proxy.ts refreshes the session.
          }
        },
      },
    },
  );
}
