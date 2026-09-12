"use server";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { order, insurancePolicy, auditEntry, ledgerEntry } from "@/lib/schema";
import { requirePermission } from "@/lib/server-session";
import { applyWalletMovement } from "@/lib/wallet-mutations";

export type PolicyActionState = { ok: boolean; message: string } | null;

/**
 * Cancel a bound policy and refund the full amount paid to the customer's
 * wallet — one transaction through the ledger engine (order:refund).
 */
export async function cancelPolicy(reference: string): Promise<PolicyActionState> {
  const staff = await requirePermission({ order: ["refund"] });

  const rows = await db.select().from(order).where(eq(order.reference, reference)).limit(1);
  const o = rows[0];
  if (!o) return { ok: false, message: "Policy not found." };
  if (o.stage === "cancelled") return { ok: false, message: "This policy is already cancelled." };

  // Support may already have returned part of the premium on a ticket. Refund
  // only what is still outstanding, so the two paths can't both pay it back.
  const [prior] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntry.amount}), 0)::int` })
    .from(ledgerEntry)
    .where(and(eq(ledgerEntry.type, "refund"), eq(ledgerEntry.orderId, o.id)));
  const alreadyRefunded = Number(prior?.total ?? 0);
  const refundDue = Math.max(0, o.total - alreadyRefunded);

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(order).set({ stage: "cancelled" }).where(eq(order.id, o.id));
    await tx
      .update(insurancePolicy)
      .set({ certificateUrl: null })
      .where(eq(insurancePolicy.orderId, o.id));
    if (refundDue > 0) {
      await applyWalletMovement(tx, {
        userId: o.userId,
        amount: refundDue, // positive = credit
        type: "refund",
        description: `Refund · ${reference} · policy cancelled`,
        orderId: o.id,
        createdBy: staff.id,
      });
    }
    await tx.insert(auditEntry).values({
      id: randomUUID(),
      actorId: staff.id,
      actorName: staff.name,
      action: "Policy cancelled",
      actionTone: "danger",
      targetType: "order",
      targetRef: reference,
      detail:
        alreadyRefunded > 0
          ? `₦${refundDue.toLocaleString("en-NG")} refunded (₦${alreadyRefunded.toLocaleString("en-NG")} already returned)`
          : `₦${refundDue.toLocaleString("en-NG")} refunded to wallet`,
      createdAt: now,
    });
  });

  revalidatePath(`/admin/orders/${reference}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/wallets");
  revalidatePath("/orders");
  revalidatePath("/wallet");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message:
      refundDue > 0
        ? `Policy cancelled · ₦${refundDue.toLocaleString("en-NG")} refunded.`
        : "Policy cancelled · the premium had already been refunded in full.",
  };
}
