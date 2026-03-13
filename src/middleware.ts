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

  if (!isProtected && !isAuthOnly) {
    return next();
  }

  // Get session from cookie
  const sessionToken = cookies.get("session")?.value;
  const user = sessionToken ? await verifySession(sessionToken) : null;

  // Not logged in → redirect to login
  if (isProtected && !user) {
    return redirect(`/login?redirectTo=${encodeURIComponent(pathname)}`);
  }

  // Already logged in → redirect away from login/register
  if (isAuthOnly && user) {
    const role = user.role ?? "buyer";
    return redirect(
      role === "admin"
        ? "/dashboard/admin"
        : role === "seller"
          ? "/dashboard/seller"
          : "/dashboard/buyer",
    );
  }

  // Role-based dashboard guard: /dashboard/seller only for sellers, etc.
  if (isProtected && user) {
    const role = user.role ?? "buyer";

    // Expose user info to pages via locals
    context.locals.userId = user.id;
    context.locals.userRole = role;
    context.locals.userEmail = user.email;
    context.locals.userName = user.name;

    if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
      return redirect("/dashboard/" + role);
    }
    if (
      pathname.startsWith("/dashboard/seller") &&
      role !== "seller" &&
      role !== "admin"
    ) {
      return redirect("/dashboard/buyer");
    }
    if (
      pathname.startsWith("/dashboard/buyer") &&
      role !== "buyer" &&
      role !== "admin"
    ) {
      return redirect("/dashboard/seller");
    }
  }

  return next();
});
