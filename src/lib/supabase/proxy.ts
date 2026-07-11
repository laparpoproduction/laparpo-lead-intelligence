import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  const env = getPublicEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (!data.user && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (data.user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
