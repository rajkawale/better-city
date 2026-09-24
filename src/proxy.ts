import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const { url, key, ready } = publicEnv();
  if (!ready) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login" || path === "/password";
  const isPublic = path.startsWith("/show") || path === "/" || isAuthPage;

  if (!user && (path.startsWith("/field") || path.startsWith("/admin") || path.startsWith("/api/admin"))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    if (path.startsWith("/admin")) login.searchParams.set("next", "/admin");
    if (path.startsWith("/field")) login.searchParams.set("next", "/field");
    return NextResponse.redirect(login);
  }

  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active, must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.active) {
      await supabase.auth.signOut();
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.searchParams.set("error", "deactivated");
      return NextResponse.redirect(login);
    }

    if (profile.must_change_password && path !== "/password") {
      const next = request.nextUrl.clone();
      next.pathname = "/password";
      return NextResponse.redirect(next);
    }

    if (path.startsWith("/admin") && profile.role === "executive") {
      const next = request.nextUrl.clone();
      next.pathname = "/field";
      return NextResponse.redirect(next);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)"],
};
