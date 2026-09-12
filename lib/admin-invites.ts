import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { staffInvite } from "./auth-schema";
import type { StaffRole } from "./permissions";

export interface InviteRow {
  id: string;
  email: string;
  role: StaffRole;
  invitedByEmail: string | null;
  createdAt: string;
}

/** Pending staff invitations for the /admin/staff console. */
export async function listPendingInvites(): Promise<InviteRow[]> {
  const rows = await db
    .select()
    .from(staffInvite)
    .where(eq(staffInvite.status, "pending"))
    .orderBy(desc(staffInvite.createdAt));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role as StaffRole,
    invitedByEmail: r.invitedByEmail,
    createdAt: new Date(r.createdAt).toISOString().slice(0, 10),
  }));
}
