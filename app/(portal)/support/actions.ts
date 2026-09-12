"use server";

import { randomUUID, randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ticket, ticketMessage } from "@/lib/schema";
import { requireCustomer } from "@/lib/server-session";

export type SupportState = { ok: boolean; message: string } | null;

const CHANNELS = ["Insurance", "Wallet", "Account"] as const;
const SLA_HOURS = 48;

/** e.g. TKT-04821 — unique human reference. */
function newTicketRef(): string {
  return `TKT-${randomInt(0, 100_000).toString().padStart(5, "0")}`;
}

/** Allocate a reference not already taken (a few tries; collisions are rare). */
async function uniqueTicketRef(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const ref = newTicketRef();
    const clash = await db
      .select({ id: ticket.id })
      .from(ticket)
      .where(eq(ticket.reference, ref))
      .limit(1);
    if (!clash[0]) return ref;
  }
  return `TKT-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** Customer opens a new support ticket (with the first message). */
export async function createTicket(
  _prev: SupportState,
  formData: FormData,
): Promise<SupportState> {
  const me = await requireCustomer();

  const subject = String(formData.get("subject") ?? "").trim();
  const channelRaw = String(formData.get("channel") ?? "Insurance");
  const channel = (CHANNELS as readonly string[]).includes(channelRaw) ? channelRaw : "Insurance";
  const body = String(formData.get("body") ?? "").trim();
  const priorityHigh = formData.get("priority") === "high";

  if (subject.length < 4) return { ok: false, message: "Add a short subject (at least 4 characters)." };
  if (!body) return { ok: false, message: "Describe your issue so the team can help." };

  const now = new Date();
  const id = randomUUID();
  const reference = await uniqueTicketRef();

  await db.insert(ticket).values({
    id,
    reference,
    userId: me.id,
    subject,
    channel,
    priority: priorityHigh ? "high" : "normal",
    status: "open",
    slaDueAt: new Date(now.getTime() + SLA_HOURS * 3_600_000),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(ticketMessage).values({
    id: randomUUID(),
    ticketId: id,
    authorId: me.id,
    authorName: me.name,
    authorRole: "customer",
    body,
    internal: false,
    createdAt: now,
  });

  revalidatePath("/support");
  revalidatePath("/admin/support");
  return { ok: true, message: `Ticket ${reference} opened.` };
}

/** Customer replies to one of their own tickets. */
export async function replyToTicket(
  _prev: SupportState,
  formData: FormData,
): Promise<SupportState> {
  const me = await requireCustomer();

  const reference = String(formData.get("ticket") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, message: "Type a message first." };

  const t = (
    await db
      .select()
      .from(ticket)
      .where(and(eq(ticket.reference, reference), eq(ticket.userId, me.id)))
      .limit(1)
  )[0];
  if (!t) return { ok: false, message: "Ticket not found." };

  const now = new Date();
  await db.insert(ticketMessage).values({
    id: randomUUID(),
    ticketId: t.id,
    authorId: me.id,
    authorName: me.name,
    authorRole: "customer",
    body,
    internal: false,
    createdAt: now,
  });
  // A customer reply re-opens a resolved ticket.
  await db
    .update(ticket)
    .set({ updatedAt: now, status: t.status === "resolved" ? "open" : t.status })
    .where(eq(ticket.id, t.id));

  revalidatePath("/support");
  revalidatePath("/admin/support");
  return { ok: true, message: "Reply sent." };
}
