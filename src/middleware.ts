import { defineMiddleware } from "astro:middleware";
import { verifySession } from "./lib/auth";
import { supabaseAdmin } from "./lib/supabaseAdmin";

// Routes that require authentication (prefix match)
const PROTECTED_PREFIXES = ["/dashboard"];

// Routes only accessible when NOT logged in
const AUTH_ONLY_ROUTES = ["/login", "/register"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect, cookies } = context;
  const pathname = url.pathname;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_ROUTES.includes(pathname);

  // Get session from cookie for all routes so Navbar & pages
  // can access user info via Astro.locals
  const sessionToken = cookies.get("session")?.value;
  const user = sessionToken ? await verifySession(sessionToken) : null;

  if (user) {
    const role = user.role ?? "buyer";
    context.locals.userId = user.id;
    context.locals.userRole = role;
    context.locals.userEmail = user.email;
    context.locals.userName = user.name;
  }

  // Not logged in → redirect to login when accessing protected routes
  if (isProtected && !user) {
    return redirect(`/login?redirectTo=${encodeURIComponent(pathname)}`);
  }

  // Already logged in → redirect away from login/register
  if (isAuthOnly && user) {
    const role = user.role ?? "buyer";
    return redirect(role === "admin" ? "/dashboard/admin" : "/shop");
  }

  // Role-based dashboard guard: only admin can access dashboard areas
  if (isProtected && user) {
    const role = user.role ?? "buyer";

    // No more buyer dashboard area: redirect any /dashboard/buyer* access
    if (pathname.startsWith("/dashboard/buyer")) {
      return redirect(role === "admin" ? "/dashboard/admin" : "/shop");
    }

    if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
      // Non-admins trying to hit admin dashboard
      return redirect("/shop");
    }
    if (pathname.startsWith("/dashboard/seller") && role !== "admin") {
      // Hanya admin yang boleh mengakses area seller (admin sebagai penjual)
      return redirect("/shop");
    }
  }

  return next();
});
