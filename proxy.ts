import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic auth redirects ONLY. This runs on every matched request (incl.
 * prefetches), so it must not hit the DB or call getSession — it just checks
 * for the presence of the session cookie. The real boundary is server-side in
 * lib/server-session.ts (requireCustomer / requireStaff / requirePermission).
 */
const protectedPrefixes = [
  "/dashboard",
  "/wallet",
  "/orders",
  "/insurance",
  "/kyc",
  "/support",
  "/admin",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);

  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Not signed in → bounce protected routes to the sign-in page.
  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // NOTE: no "/" → /dashboard redirect here. Cookie *presence* doesn't mean
  // the session is valid, and redirecting on it loops forever when the cookie
  // is stale (proxy sends / → /dashboard, requireCustomer sends it back).
  // The sign-in page validates the real session and forwards instead.

  return NextResponse.next();
}

export const config = {
  // Exclude API (incl. /api/auth), Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
