import "server-only";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { order, insurancePolicy, ticket } from "./schema";
import { user } from "./auth-schema";
import { RENEWAL_WINDOW_DAYS } from "./quote";
import type { NavBadges } from "./nav";

/**
 * Live sidebar badge counts. Every number here is a real DB aggregate — a zero
 * count is omitted so the badge simply doesn't render (no "0" chips).
 */

function badge(map: NavBadges, href: string, n: number) {
  if (n > 0) map[href] = n.toLocaleString("en-NG");
}

async function countOf(query: Promise<{ n: number }[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

function renewalWindow(): { from: Date; to: Date } {
  const from = new Date();
  const to = new Date(from.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Customer sidebar: unresolved tickets + policies due for renewal. */
export async function getCustomerNavBadges(userId: string): Promise<NavBadges> {
  const { from, to } = renewalWindow();
  const [openTickets, renewals] = await Promise.all([
    countOf(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(ticket)
        .where(and(eq(ticket.userId, userId), ne(ticket.status, "resolved"))),
    ),
    countOf(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(order)
        .innerJoin(insurancePolicy, eq(insurancePolicy.orderId, order.id))
        .where(
          and(
            eq(order.userId, userId),
            eq(order.stage, "active"),
            gte(insurancePolicy.periodEnd, from),
            lte(insurancePolicy.periodEnd, to),
          ),
        ),
    ),
  ]);

  const badges: NavBadges = {};
  badge(badges, "/support", openTickets);
  badge(badges, "/orders", renewals);
  return badges;
}

/**
 * Admin sidebar:
 *  - User control  → customers with KYC still pending review
 *  - Policies      → active policies due for renewal in the next 14 days
 *  - Support inbox → unresolved tickets
 */
export async function getAdminNavBadges(): Promise<NavBadges> {
  const { from, to } = renewalWindow();
  const [kycPending, renewals, openTickets] = await Promise.all([
    countOf(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(user)
        .where(and(eq(user.role, "user"), eq(user.kyc, "pending"))),
    ),
    countOf(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(order)
        .innerJoin(insurancePolicy, eq(insurancePolicy.orderId, order.id))
        .where(
          and(
            eq(order.stage, "active"),
            gte(insurancePolicy.periodEnd, from),
            lte(insurancePolicy.periodEnd, to),
          ),
        ),
    ),
    countOf(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(ticket)
        .where(ne(ticket.status, "resolved")),
    ),
  ]);

  const badges: NavBadges = {};
  badge(badges, "/admin/users", kycPending);
  badge(badges, "/admin/orders", renewals);
  badge(badges, "/admin/support", openTickets);
  return badges;
}
