import "server-only";
import { eq, and, asc } from "drizzle-orm";
import { db } from "./db";
import { wallet, order, insurancePolicy, insurancePlan } from "./schema";
import { customer, type Status } from "./mock-data";
import { requireCustomer } from "./server-session";
import { RENEWAL_WINDOW_DAYS } from "./quote";

export type DashboardPolicy = {
  orderId: string;
  name: string;
  underwriter: string;
  expires: string;
  status: Status;
};

export type Dashboard = {
  dateLabel: string;
  summary: string;
  firstName: string;
  initial: string;
  wallet: { id: string; balance: number; lastReconciled: string };
  activePolicies: DashboardPolicy[];
  /** Total sum insured across active policies. */
  totalCover: number;
};

/** "Friday, May 1 · 2026" */
function dateLabel(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${d.getDate()} · ${d.getFullYear()}`;
}

/** "Aug 14" */
function shortDate(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${String(d.getDate()).padStart(2, "0")}`;
}

/** "14:48" */
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Customer dashboard for the current user, sourced entirely from the DB. */
export async function getDashboard(): Promise<Dashboard> {
  const me = await requireCustomer();

  const walletRows = await db
    .select()
    .from(wallet)
    .where(eq(wallet.userId, me.id))
    .limit(1);
  const w = walletRows[0];

  // Active policies, soonest expiry first.
  const policyRows = await db
    .select({
      reference: order.reference,
      planName: insurancePlan.name,
      policyUnderwriter: insurancePolicy.underwriter,
      planUnderwriter: insurancePlan.underwriter,
      periodEnd: insurancePolicy.periodEnd,
      sumInsured: insurancePolicy.sumInsured,
    })
    .from(insurancePolicy)
    .innerJoin(order, eq(insurancePolicy.orderId, order.id))
    .leftJoin(insurancePlan, eq(insurancePolicy.planId, insurancePlan.id))
    .where(and(eq(order.userId, me.id), eq(order.kind, "insurance"), eq(order.stage, "active")))
    .orderBy(asc(insurancePolicy.periodEnd));

  const now = new Date();
  const windowMs = RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const activePolicies: DashboardPolicy[] = policyRows
    .filter((p) => !p.periodEnd || new Date(p.periodEnd).getTime() >= now.getTime())
    .map((p) => {
      const end = p.periodEnd ? new Date(p.periodEnd) : null;
      const renewing = end !== null && end.getTime() - now.getTime() <= windowMs;
      return {
        orderId: p.reference,
        name: p.planName ?? "—",
        underwriter: (p.policyUnderwriter ?? p.planUnderwriter ?? "—").split(" ")[0],
        expires: end ? shortDate(end) : "—",
        status: renewing ? "renew" : "active",
      };
    });

  const totalCover = policyRows.reduce((sum, p) => sum + (p.sumInsured ?? 0), 0);
  const renewingCount = activePolicies.filter((p) => p.status === "renew").length;
  const summary =
    activePolicies.length === 0
      ? "You have no active cover yet — compare quotes and bind your first policy."
      : `You have ${activePolicies.length} active ${activePolicies.length === 1 ? "policy" : "policies"}` +
        (renewingCount > 0
          ? ` and ${renewingCount} renewing in the next ${RENEWAL_WINDOW_DAYS} days.`
          : " and nothing due for renewal.");

  return {
    dateLabel: dateLabel(now),
    summary,
    firstName: me.name.split(" ")[0] || me.name,
    initial: (me.name.trim()[0] ?? "U").toUpperCase(),
    wallet: {
      id: w?.reference ?? customer.walletId,
      balance: w?.balance ?? 0,
      lastReconciled: hhmm(w?.updatedAt ? new Date(w.updatedAt) : now),
    },
    activePolicies,
    totalCover,
  };
}
