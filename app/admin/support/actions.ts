"use server";

import { randomUUID } from "node:crypto";
import { and, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ticket, ticketMessage, ledgerEntry, order } from "@/lib/schema";
import { requirePermission } from "@/lib/server-session";
import { applyWalletMovement } from "@/lib/wallet-mutations";

export type SupportState = { ok: boolean; message: string } | null;

async function ticketByRef(reference: string) {
  return (
    await db.select().from(ticket).where(eq(ticket.reference, reference)).limit(1)
  )[0];
}

function revalidateTicket(reference: string) {
  revalidatePath(`/admin/support/${reference}`);
  revalidatePath("/admin/support");
  revalidatePath("/support");
}

/** Staff reply, or a staff-only internal note (hidden from the customer). */
export async function replyToTicketAdmin(
  _prev: SupportState,
  formData: FormData,
): Promise<SupportState> {
  const staff = await requirePermission({ ticket: ["respond"] });

  const reference = String(formData.get("ticket") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const internal = formData.get("internal") === "true";
  if (!body) return { ok: false, message: "Type a message first." };

  const t = await ticketByRef(reference);
  if (!t) return { ok: false, message: "Ticket not found." };

  const now = new Date();
  await db.insert(ticketMessage).values({
    id: randomUUID(),
    ticketId: t.id,
    authorId: staff.id,
    authorName: staff.name,
    authorRole: "staff",
    body,
    internal,
    createdAt: now,
  });
  // A public reply moves an open ticket into review; internal notes don't.
  await db
    .update(ticket)
    .set({ updatedAt: now, status: !internal && t.status === "open" ? "in-review" : t.status })
    .where(eq(ticket.id, t.id));

  revalidateTicket(reference);
  return { ok: true, message: internal ? "Internal note saved." : "Reply sent." };
}

/** Mark a ticket resolved. */
export async function resolveTicket(reference: string): Promise<SupportState> {
  await requirePermission({ ticket: ["respond"] });
  const t = await ticketByRef(reference);
  if (!t) return { ok: false, message: "Ticket not found." };
  await db
    .update(ticket)
    .set({ status: "resolved", updatedAt: new Date() })
    .where(eq(ticket.id, t.id));
  revalidateTicket(reference);
  return { ok: true, message: "Ticket resolved." };
}

/** Assign the ticket to the acting staff member. */
export async function assignToMe(reference: string): Promise<SupportState> {
  const staff = await requirePermission({ ticket: ["respond"] });
  const t = await ticketByRef(reference);
  if (!t) return { ok: false, message: "Ticket not found." };
  await db
    .update(ticket)
    .set({ assignedTo: staff.id, updatedAt: new Date() })
    .where(eq(ticket.id, t.id));
  revalidateTicket(reference);
  return { ok: true, message: "Assigned to you." };
}

/** Escalate: bump priority to high and drop an internal note. */
export async function escalateTicket(reference: string): Promise<SupportState> {
  const staff = await requirePermission({ ticket: ["respond"] });
  const t = await ticketByRef(reference);
  if (!t) return { ok: false, message: "Ticket not found." };
  const now = new Date();
  await db
    .update(ticket)
    .set({ priority: "high", updatedAt: now })
    .where(eq(ticket.id, t.id));
  await db.insert(ticketMessage).values({
    id: randomUUID(),
    ticketId: t.id,
    authorId: staff.id,
    authorName: staff.name,
    authorRole: "staff",
    body: "Escalated to finance for review.",
    internal: true,
    createdAt: now,
  });
  revalidateTicket(reference);
  return { ok: true, message: "Escalated to finance." };
}

const MAX_REFUND = 10_000_000;

/** Marker written into every ticket refund's description, so prior refunds on
 * the same ticket can be totalled without a schema change. */
function refundTag(ticketRef: string): string {
  return `Refund · ${ticketRef}`;
}

/**
 * How much has already been refunded against this ticket, and the ceiling for
 * a further refund.
 *
 * When the ticket is linked to a policy the ceiling is what the customer
 * actually paid for it, less anything already returned — that is the invariant
 * that stops a 16,200 naira policy being refunded for more than it cost.
 * Orderless tickets (wallet or account queries) fall back to the flat cap.
 */
async function refundHeadroom(t: { id: string; reference: string; orderId: string | null }) {
  const [already] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntry.amount}), 0)::int` })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.type, "refund"),
        like(ledgerEntry.description, `${refundTag(t.reference)}%`),
      ),
    );
  const refunded = Number(already?.total ?? 0);

  if (!t.orderId) return { refunded, ceiling: MAX_REFUND, paid: null as number | null };

  const [o] = await db
    .select({ total: order.total })
    .from(order)
    .where(eq(order.id, t.orderId))
    .limit(1);
  const paid = o?.total ?? null;
  if (paid === null) return { refunded, ceiling: MAX_REFUND, paid };

  // Count every refund booked against the order, not just ticket ones, so a
  // policy cancellation and a ticket refund can't both return the premium.
  const [onOrder] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntry.amount}), 0)::int` })
    .from(ledgerEntry)
    .where(and(eq(ledgerEntry.type, "refund"), eq(ledgerEntry.orderId, t.orderId)));
  const refundedOnOrder = Number(onOrder?.total ?? 0);

  return { refunded: refundedOnOrder, ceiling: Math.max(0, paid - refundedOnOrder), paid };
}

export async function issueTicketRefund(
  _prev: SupportState,
  formData: FormData,
): Promise<SupportState> {
  const staff = await requirePermission({ order: ["refund"] });

  const reference = String(formData.get("ticket") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").replace(/[,\s₦]/g, ""));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!Number.isInteger(amount) || amount < 1) {
    return { ok: false, message: "Enter a whole refund amount of at least ₦1." };
  }
  if (amount > MAX_REFUND) {
    return { ok: false, message: "That refund amount looks too large — double-check it." };
  }

  const t = await ticketByRef(reference);
  if (!t) return { ok: false, message: "Ticket not found." };

  const { refunded, ceiling, paid } = await refundHeadroom(t);
  if (ceiling <= 0) {
    return {
      ok: false,
      message: paid
        ? `Already fully refunded — ₦${refunded.toLocaleString("en-NG")} of ₦${paid.toLocaleString("en-NG")} has been returned.`
        : "This ticket has already been refunded up to the limit.",
    };
  }
  if (amount > ceiling) {
    return {
      ok: false,
      message: paid
        ? `That is more than remains on this policy. Paid ₦${paid.toLocaleString("en-NG")}, already refunded ₦${refunded.toLocaleString("en-NG")}, so at most ₦${ceiling.toLocaleString("en-NG")} can be returned.`
        : `At most ₦${ceiling.toLocaleString("en-NG")} can be refunded on this ticket.`,
    };
  }

  const now = new Date();
  const description = reason ? `${refundTag(reference)} · ${reason}` : refundTag(reference);

  await db.transaction(async (tx) => {
    await applyWalletMovement(tx, {
      userId: t.userId,
      amount, // positive = credit
      type: "refund",
      description,
      orderId: t.orderId ?? null,
      createdBy: staff.id,
    });
    await tx.insert(ticketMessage).values({
      id: randomUUID(),
      ticketId: t.id,
      authorId: staff.id,
      authorName: staff.name,
      authorRole: "staff",
      body: `Refund of ₦${amount.toLocaleString("en-NG")} issued to your wallet${reason ? ` — ${reason}` : ""}.`,
      internal: false,
      createdAt: now,
    });
    await tx.update(ticket).set({ updatedAt: now }).where(eq(ticket.id, t.id));
  });

  revalidateTicket(reference);
  revalidatePath("/admin/wallets");
  revalidatePath("/wallet");
  return { ok: true, message: `₦${amount.toLocaleString("en-NG")} refunded.` };
}
