import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { logConfigurationUnavailableOnce } from "@/lib/configuration-log";
import {
  getApplicationModeResolution,
  getPublicEnv,
  SERVICE_UNAVAILABLE_PATH,
} from "@/lib/env";

const publicAssetPattern =
  /^\/(?:_next\/(?:static|image)\/|favicon\.ico$|.*\.(?:svg|png|jpg|jpeg|gif|webp)$)/;

function isConfigurationSafePath(pathname: string): boolean {
  return pathname === SERVICE_UNAVAILABLE_PATH || publicAssetPattern.test(pathname);
}

export async function updateSession(request: NextRequest) {
  const applicationMode = getApplicationModeResolution();
  const pathname = request.nextUrl.pathname;

  if (isConfigurationSafePath(pathname)) {
    return NextResponse.next({ request });
  }

  if (applicationMode.mode === "demo") {
    return NextResponse.next({ request });
  }

  if (applicationMode.mode === "misconfigured") {
    logConfigurationUnavailableOnce("session_proxy", applicationMode);
    const url = request.nextUrl.clone();
    url.pathname = SERVICE_UNAVAILABLE_PATH;
    url.search = "";
    return NextResponse.rewrite(url, { status: 503 });
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
  const isLoginRoute = pathname.startsWith("/login");

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
