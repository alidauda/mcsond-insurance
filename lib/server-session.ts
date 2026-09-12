import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { roles, STAFF_ROLES, type Role } from "./permissions";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: Role;
  banned?: boolean | null;
};

/**
 * Data Access Layer. `cache()` memoizes the session read for one render pass,
 * so calling requireX() in a layout and again in a page/action is one DB hit.
 * This is the real security boundary (proxy.ts is optimistic only, and layouts
 * don't re-run on client navigation).
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function toUser(session: NonNullable<Awaited<ReturnType<typeof getSession>>>): SessionUser {
  const u = session.user as SessionUser;
  return { ...u, role: (u.role ?? "user") as Role };
}

/** Require a signed-in customer. Staff are bounced to /admin; anon to /. */
export async function requireCustomer() {
  const session = await getSession();
  if (!session) redirect("/");
  const user = toUser(session);
  if (user.role !== "user") redirect("/admin");
  return { ...user, initials: initials(user.name) };
}

/** Require a signed-in staff member. Customers are bounced to /dashboard. */
export async function requireStaff() {
  const session = await getSession();
  if (!session) redirect("/");
  const user = toUser(session);
  if (!STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number])) {
    redirect("/dashboard");
  }
  return { ...user, initials: initials(user.name) };
}

/**
 * Authorize a specific permission for the current staff member (server-side).
 * Use in every mutating server action — UI gating is not enough.
 * Throws if unauthorized.
 */
export async function requirePermission(
  permissions: { [resource: string]: string[] },
): Promise<SessionUser> {
  const user = await requireStaff();
  const role = roles[user.role as keyof typeof roles];
  const result = role?.authorize(permissions as Parameters<typeof role.authorize>[0]);
  if (!result?.success) {
    throw new Error("FORBIDDEN: insufficient permissions");
  }
  return user;
}
