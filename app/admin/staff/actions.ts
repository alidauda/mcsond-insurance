"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { staffInvite, user } from "@/lib/auth-schema";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/server-session";
import { sendStaffInvite } from "@/lib/email";
import { STAFF_ROLES, type StaffRole } from "@/lib/permissions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteResult = { ok: boolean; message: string };

/**
 * Invite a staff member by email + role (superadmin only — user:create).
 * - If the email already has an account, update its role immediately.
 * - Otherwise record a pending invite (assigned on first Google sign-in via the
 *   create hook in lib/auth.ts) and send the invitation email via Resend.
 */
export async function inviteStaff(emailRaw: string, role: StaffRole): Promise<InviteResult> {
  const actor = await requirePermission({ user: ["create"] });
  const email = (emailRaw ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (!STAFF_ROLES.includes(role)) return { ok: false, message: "Pick a valid role." };

  // Already has an account → set the role now (the create hook won't re-run).
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existing[0]) {
    await auth.api.setRole({ headers: await headers(), body: { userId: existing[0].id, role } });
    revalidatePath("/admin/staff");
    revalidatePath("/admin/users");
    return { ok: true, message: `${email} already had an account — role set to ${role}.` };
  }

  // Upsert a pending invite for this email.
  const pending = await db
    .select({ id: staffInvite.id })
    .from(staffInvite)
    .where(and(eq(staffInvite.email, email), eq(staffInvite.status, "pending")))
    .limit(1);

  const inviteId = pending[0]?.id ?? randomUUID();
  if (pending[0]) {
    await db
      .update(staffInvite)
      .set({ role, invitedByEmail: actor.email })
      .where(eq(staffInvite.id, inviteId));
  } else {
    await db.insert(staffInvite).values({
      id: inviteId,
      email,
      role,
      status: "pending",
      invitedByEmail: actor.email,
    });
  }

  const signInUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const sent = await sendStaffInvite({ to: email, role, inviteId, signInUrl, invitedByEmail: actor.email });

  revalidatePath("/admin/staff");
  return sent.ok
    ? { ok: true, message: `Invite sent to ${email} as ${role}.` }
    : { ok: true, message: `Invite saved for ${email}, but email not sent — ${sent.error}` };
}

/** Revoke a pending invite (superadmin only). */
export async function revokeInvite(id: string): Promise<{ ok: boolean }> {
  await requirePermission({ user: ["create"] });
  await db.update(staffInvite).set({ status: "revoked" }).where(eq(staffInvite.id, id));
  revalidatePath("/admin/staff");
  return { ok: true };
}
