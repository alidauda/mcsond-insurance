import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { order, ticket, ticketMessage } from "./schema";
import { user } from "./auth-schema";
import { requireCustomer, requireStaff } from "./server-session";
import type {
  CustomerTicket,
  QueueTicket,
  TicketMessage,
} from "./mock-data";

/* ───────────────────────── helpers ───────────────────────── */

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** "Adaeze Onuoha" → "Adaeze O." (matches supportQueue.user shape). */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const first = parts.slice(0, -1).join(" ");
  const last = parts[parts.length - 1];
  return `${first} ${last[0]}.`;
}

/** Relative age label, e.g. "2h ago" / "1d ago". */
function relativeAge(from: Date | null | undefined): string {
  if (!from) return "—";
  const ms = Date.now() - new Date(from).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

/** Fraction of SLA window elapsed (0..1), clamped. */
function slaFraction(
  createdAt: Date | null | undefined,
  dueAt: Date | null | undefined,
): number {
  if (!createdAt || !dueAt) return 0;
  const start = new Date(createdAt).getTime();
  const end = new Date(dueAt).getTime();
  if (end <= start) return 1;
  const frac = (Date.now() - start) / (end - start);
  return Math.max(0, Math.min(1, Math.round(frac * 100) / 100));
}

function ticketChannel(v: unknown): CustomerTicket["channel"] {
  return v === "Wallet" || v === "Account" ? v : "Insurance";
}

function queueType(v: unknown): QueueTicket["type"] {
  return v === "Wallet" || v === "Account" ? v : "Insurance";
}

function ticketStatus(v: unknown): CustomerTicket["status"] {
  return v === "in-review" || v === "resolved" ? v : "open";
}

function messageRole(v: unknown): TicketMessage["role"] {
  return v === "staff" || v === "operations" ? "operations" : "customer";
}

function timeLabel(d: Date | null | undefined): string {
  if (!d) return "Recently";
  return new Date(d).toISOString().slice(11, 16); // HH:MM
}

/* ───────────────────────── customer-scoped ───────────────────────── */

/**
 * The current customer's tickets, newest first, with the full message thread
 * inlined on each (matches mock-data `customerTickets`).
 */
export async function getCustomerTickets(): Promise<CustomerTicket[]> {
  const me = await requireCustomer();

  const rows = await db
    .select()
    .from(ticket)
    .where(eq(ticket.userId, me.id))
    .orderBy(desc(ticket.createdAt));

  const tickets: CustomerTicket[] = [];
  for (const t of rows) {
    // Internal (staff-only) notes are never shown to the customer.
    const msgs = await db
      .select()
      .from(ticketMessage)
      .where(and(eq(ticketMessage.ticketId, t.id), eq(ticketMessage.internal, false)))
      .orderBy(asc(ticketMessage.createdAt));

    const thread: TicketMessage[] = msgs.map((m) => ({
      author: m.authorName ?? "Customer",
      time: timeLabel(m.createdAt),
      role: messageRole(m.authorRole),
      body: m.body ?? "",
    }));

    const ct: CustomerTicket = {
      id: t.reference,
      subject: t.subject ?? "",
      channel: ticketChannel(t.channel),
      age: relativeAge(t.updatedAt ?? t.createdAt),
      status: ticketStatus(t.status),
      ...(t.priority === "high" ? { priority: "High priority" as const } : {}),
      ...(thread.length ? { thread } : {}),
    };
    tickets.push(ct);
  }

  return tickets;
}

/* ───────────────────────── admin (all users) ───────────────────────── */

/**
 * Full support queue across all users (matches mock-data `supportQueue`),
 * newest activity first.
 */
export async function getSupportQueue(): Promise<QueueTicket[]> {
  const owner = db
    .select()
    .from(user)
    .as("owner");
  // assignee user (alias) for resolving assigned name/initials.
  const assignee = db.select().from(user).as("assignee");

  const rows = await db
    .select({
      reference: ticket.reference,
      subject: ticket.subject,
      channel: ticket.channel,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      slaDueAt: ticket.slaDueAt,
      ownerName: owner.name,
      assignedName: assignee.name,
    })
    .from(ticket)
    .leftJoin(owner, eq(ticket.userId, owner.id))
    .leftJoin(assignee, eq(ticket.assignedTo, assignee.id))
    .orderBy(desc(ticket.updatedAt));

  return rows.map((r) => ({
    id: r.reference,
    subject: r.subject ?? "",
    user: r.ownerName ? shortName(r.ownerName) : "—",
    type: queueType(r.channel),
    priority: r.priority === "high" ? "High" : "Normal",
    assigned: r.assignedName ?? "Unassigned",
    assignedInitials: r.assignedName ? initials(r.assignedName) : "—",
    sla: slaFraction(r.createdAt, r.slaDueAt),
    updated: relativeAge(r.updatedAt ?? r.createdAt),
  }));
}

/** Single queued ticket by its human reference (e.g. TKT-0421). */
export async function getQueueTicket(
  id: string,
): Promise<QueueTicket | undefined> {
  const queue = await getSupportQueue();
  return queue.find((t) => t.id === id);
}

/**
 * Message thread for a ticket (by reference). Falls back to a single
 * placeholder customer message if there are none — matching mock-data.
 */
export async function getTicketThread(
  id: string,
  subject: string,
): Promise<TicketMessage[]> {
  const t = (
    await db.select().from(ticket).where(eq(ticket.reference, id)).limit(1)
  )[0];

  if (t) {
    const msgs = await db
      .select()
      .from(ticketMessage)
      .where(eq(ticketMessage.ticketId, t.id))
      .orderBy(asc(ticketMessage.createdAt));

    if (msgs.length) {
      return msgs.map((m) => ({
        author: m.authorName ?? "Customer",
        time: timeLabel(m.createdAt),
        role: messageRole(m.authorRole),
        body: m.body ?? "",
        internal: m.internal,
      }));
    }
  }

  return [
    {
      author: "Customer",
      time: "Recently",
      role: "customer",
      body: `${subject}. Awaiting an agent response.`,
    },
  ];
}

/* ── support → user / order links (admin) ── */

/* ── live queue counters (admin) ── */

export type SupportQueueStats = {
  /** Unresolved tickets across all users. */
  open: number;
  filters: { key: string; label: string; count: number }[];
};

/**
 * Headline + filter-chip counts for /admin/support, all derived from the queue
 * itself so the numbers always agree with the rows on screen.
 * "SLA at risk" uses the same >70%-elapsed threshold as the ticket detail page.
 */
export async function getSupportQueueStats(): Promise<SupportQueueStats> {
  const me = await requireStaff();

  const rows = await db
    .select({
      status: ticket.status,
      assignedTo: ticket.assignedTo,
      createdAt: ticket.createdAt,
      slaDueAt: ticket.slaDueAt,
    })
    .from(ticket);

  const unresolved = rows.filter((r) => r.status !== "resolved");

  return {
    open: unresolved.length,
    filters: [
      {
        key: "mine",
        label: "Assigned to me",
        count: unresolved.filter((r) => r.assignedTo === me.id).length,
      },
      {
        key: "unassigned",
        label: "Unassigned",
        count: unresolved.filter((r) => !r.assignedTo).length,
      },
      {
        key: "sla",
        label: "SLA at risk",
        count: unresolved.filter((r) => slaFraction(r.createdAt, r.slaDueAt) > 0.7).length,
      },
    ],
  };
}

/** TKT reference → owning user reference-ish id (the user.id). */
export async function getQueueUserId(): Promise<Record<string, string>> {
  const rows = await db
    .select({ reference: ticket.reference, userId: ticket.userId })
    .from(ticket);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.reference] = r.userId;
  return out;
}

/** TKT reference → linked order reference (only tickets that reference one). */
export async function getQueueOrderId(): Promise<Record<string, string>> {
  const rows = await db
    .select({
      reference: ticket.reference,
      orderRef: order.reference,
    })
    .from(ticket)
    .innerJoin(order, eq(ticket.orderId, order.id));
  const out: Record<string, string> = {};
  for (const r of rows) out[r.reference] = r.orderRef;
  return out;
}
