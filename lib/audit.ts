import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { auditEntry } from "./schema";
import { user } from "./auth-schema";
import type { AuditEntry } from "./mock-data";

/** First letter of a name (System → "S"). */
function actorInitial(name: string): string {
  return (name.trim()[0] ?? "S").toUpperCase();
}

/** HH:MM:SS, matching the mock fixtures. */
function clockTime(d: Date): string {
  return new Date(d).toISOString().slice(11, 19);
}

/** Coerce the stored tone to the strict union the UI expects. */
function toneOf(v: unknown): AuditEntry["actionTone"] {
  return v === "danger" ? "danger" : "neutral";
}

/**
 * Append-only audit trail, newest first. Mirrors `auditTrail` in mock-data.
 * Admin-scoped: returns rows across all actors/targets.
 */
export async function getAuditTrail(): Promise<AuditEntry[]> {
  const rows = await db
    .select()
    .from(auditEntry)
    .orderBy(desc(auditEntry.createdAt), desc(auditEntry.seq))
    .limit(200);

  return rows.map((r) => {
    const actor = r.actorName ?? "System";
    return {
      time: clockTime(r.createdAt),
      actor,
      actorInitial: actorInitial(actor),
      action: r.action ?? "",
      actionTone: toneOf(r.actionTone),
      target: r.targetRef ?? "",
      detail: r.detail ?? "",
    };
  });
}

/**
 * Audit totals + head hash from the latest entry. Mirrors `auditSummary`.
 * `byStaff` / `bySystem` / `bySuperAdmin` partition the total:
 *   - bySystem      → entries with no actor (actorId IS NULL)
 *   - bySuperAdmin  → entries whose actor has role "superadmin"
 *   - byStaff       → all other (actor-attributed) entries
 */
export async function getAuditSummary(): Promise<{
  date: string;
  total: number;
  byStaff: number;
  bySystem: number;
  bySuperAdmin: number;
  headHash: string;
  verified: string;
}> {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      bySystem: sql<number>`count(*) filter (where ${auditEntry.actorId} is null)::int`,
      bySuperAdmin: sql<number>`count(*) filter (where ${user.role} = 'superadmin')::int`,
    })
    .from(auditEntry)
    .leftJoin(user, eq(auditEntry.actorId, user.id));

  const total = totals?.total ?? 0;
  const bySystem = totals?.bySystem ?? 0;
  const bySuperAdmin = totals?.bySuperAdmin ?? 0;
  const byStaff = total - bySystem - bySuperAdmin;

  const [head] = await db
    .select({ hash: auditEntry.hash, createdAt: auditEntry.createdAt })
    .from(auditEntry)
    .orderBy(desc(auditEntry.createdAt), desc(auditEntry.seq))
    .limit(1);

  const headHash = head?.hash ?? "0x0000…0000";
  const headDate = head?.createdAt ? new Date(head.createdAt) : new Date();

  const date = headDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const verified = clockTime(headDate).slice(0, 5);

  return { date, total, byStaff, bySystem, bySuperAdmin, headHash, verified };
}
