import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { order, insurancePolicy, insurancePlan, ledgerEntry, wallet } from "./schema";
import { user } from "./auth-schema";
import { requireCustomer } from "./server-session";
import { customer } from "./mock-data";
import type { Order, OrderDetail, AdminOrder, OrderStage, Status, InsuranceCategory, PlanProvider } from "./mock-data";
import { insuranceCategory } from "./catalog";
import { RENEWAL_WINDOW_DAYS } from "./quote";

/* ───────────────────────── helpers ───────────────────────── */

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Date → "May 02". */
function shortDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

/** Date → "04 May 2026" (policy period style). */
export function longDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "Leadway Assurance" → "Leadway" for the "(Leadway)" suffix in item labels. */
function underwriterShort(name: string | null): string {
  if (!name) return "—";
  return name.split(" ")[0];
}

function periodLabel(start: Date | null, end: Date | null): string {
  return start && end ? `${longDate(start)} – ${longDate(end)}` : "—";
}

/**
 * Derive the display stage: stored `cancelled` wins; otherwise an ended period
 * is `expired`, one ending within the renewal window is `renew`, else `active`.
 */
export function policyStage(stage: string, periodEnd: Date | null, now = new Date()): OrderStage {
  if (stage === "cancelled") return "cancelled";
  if (stage === "failed") return "failed";
  if (stage === "pending") return "pending";
  if (periodEnd) {
    const remaining = new Date(periodEnd).getTime() - now.getTime();
    if (remaining < 0) return "expired";
    if (remaining <= RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000) return "renew";
  }
  return "active";
}

/* Row shapes assembled from the joins. */

type CustomerRow = {
  ord: typeof order.$inferSelect;
  policy: typeof insurancePolicy.$inferSelect | null;
  plan: typeof insurancePlan.$inferSelect | null;
};

type AdminRow = CustomerRow & { customer: typeof user.$inferSelect | null };

/** e.g. "Comprehensive Motor (Leadway)". */
function itemLabel(row: CustomerRow): string {
  const name = row.plan?.name ?? "Insurance policy";
  const uw = row.policy?.underwriter ?? row.plan?.underwriter ?? null;
  return uw ? `${name} (${underwriterShort(uw)})` : name;
}

const CUSTOMER_SELECT = {
  ord: order,
  policy: insurancePolicy,
  plan: insurancePlan,
} as const;

/* ───────────────────────── customer-scoped ───────────────────────── */

function toOrder(row: CustomerRow): Order {
  return {
    id: row.ord.reference,
    date: shortDate(row.ord.createdAt),
    item: itemLabel(row),
    qty: "1 policy",
    total: row.ord.total,
    status: policyStage(row.ord.stage, row.policy?.periodEnd ?? null) as Status,
    kind: "Insurance",
  };
}

/** The current customer's policies, newest first. */
export async function getOrders(): Promise<Order[]> {
  const me = await requireCustomer();
  const rows = await db
    .select(CUSTOMER_SELECT)
    .from(order)
    .leftJoin(insurancePolicy, eq(insurancePolicy.orderId, order.id))
    .leftJoin(insurancePlan, eq(insurancePlan.id, insurancePolicy.planId))
    .where(eq(order.userId, me.id))
    .orderBy(desc(order.createdAt));
  return rows.map(toOrder);
}

async function findCustomerRow(reference: string): Promise<CustomerRow | undefined> {
  const me = await requireCustomer();
  const rows = await db
    .select(CUSTOMER_SELECT)
    .from(order)
    .leftJoin(insurancePolicy, eq(insurancePolicy.orderId, order.id))
    .leftJoin(insurancePlan, eq(insurancePlan.id, insurancePolicy.planId))
    .where(and(eq(order.userId, me.id), eq(order.reference, reference)))
    .limit(1);
  return rows[0];
}

/** Single customer policy by reference (e.g. "INS-2049"). */
export async function getOrder(id: string): Promise<Order | undefined> {
  const row = await findCustomerRow(id);
  return row ? toOrder(row) : undefined;
}

/** Receipt details shared by the policy page and the certificate. */
async function receiptFor(userId: string, orderId: string | null, fallbackRef: string) {
  const [entryRows, walletRows] = await Promise.all([
    orderId
      ? db
          .select({ reference: ledgerEntry.reference })
          .from(ledgerEntry)
          .where(eq(ledgerEntry.orderId, orderId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({ reference: wallet.reference })
      .from(wallet)
      .where(eq(wallet.userId, userId))
      .limit(1),
  ]);
  return {
    reference: entryRows[0]?.reference ?? `TXN-${fallbackRef.replace(/\D/g, "")}`,
    paidFrom: `Wallet ${walletRows[0]?.reference ?? customer.walletId}`,
  };
}

/** Full receipt + policy detail for one of the current customer's policies. */
export async function getOrderDetail(o: Order): Promise<OrderDetail> {
  const me = await requireCustomer();
  const row = await findCustomerRow(o.id);
  const receipt = await receiptFor(me.id, row?.ord.id ?? null, o.id);

  const p = row?.policy ?? null;
  const labels = ["Quote requested", "Paid", "Policy bound", "Certificate issued"];
  const bound = o.status !== "cancelled" && o.status !== "failed" && o.status !== "pending";
  const external = p?.certificateUrl && /^https?:\/\//.test(p.certificateUrl) ? p.certificateUrl : undefined;
  return {
    receipt: { ...receipt, total: o.total, date: o.date },
    underwriter: p?.underwriter ?? row?.plan?.underwriter ?? "—",
    policyNo: p?.policyNo ?? "—",
    period: periodLabel(p?.periodStart ?? null, p?.periodEnd ?? null),
    sumInsured: p?.sumInsured ?? undefined,
    premium: p?.basePremium ?? undefined,
    category: row?.plan?.category ?? undefined,
    hasCertificate: bound && !!p?.certificateUrl,
    // Always our certificate page; it links out to the underwriter's PDF when there is one.
    certificateHref: bound && p?.certificateUrl ? `/insurance/certificate/${o.id}` : undefined,
    externalCertificateUrl: external,
    provider: "nem",
    providerRef: p?.providerRef ?? undefined,
    steps: labels.map((label, i) => ({
      label,
      done: bound || (o.status === "pending" ? i < 2 : i < 1),
      active: o.status === "pending" && i === 2,
    })),
  };
}

/* ───────────────────────── certificate ───────────────────────── */

export type PolicyCertificate = {
  reference: string;
  product: string;
  category: InsuranceCategory;
  underwriter: string;
  underwriterMark: string;
  policyNo: string;
  insured: string;
  sumInsured: number;
  premium: number;
  stampDuty: number;
  vat: number;
  total: number;
  period: string;
  termMonths: number;
  details: Record<string, string>;
  boundAt: string;
  stage: OrderStage;
  email: string;
  receipt: { reference: string; paidFrom: string; total: number };
  provider: PlanProvider;
  providerRef: string | null;
  naicomId: string | null;
  externalCertificateUrl: string | null;
  debitNoteUrl: string | null;
  creditNoteUrl: string | null;
};

/** Certificate view for one of the current customer's bound policies. */
export async function getPolicyCertificate(reference: string): Promise<PolicyCertificate | undefined> {
  const me = await requireCustomer();
  const row = await findCustomerRow(reference);
  if (!row || !row.policy) return undefined;
  const p = row.policy;
  const receipt = await receiptFor(me.id, row.ord.id, reference);
  const underwriter = p.underwriter ?? row.plan?.underwriter ?? "—";
  const boundAt = p.boundAt ? new Date(p.boundAt) : new Date(row.ord.createdAt);

  return {
    reference,
    product: row.plan?.name ?? "Insurance policy",
    category: insuranceCategory(row.plan?.category),
    underwriter,
    underwriterMark: underwriter.charAt(0).toUpperCase(),
    policyNo: p.policyNo ?? "—",
    insured: p.insuredParty ?? me.name,
    sumInsured: p.sumInsured ?? 0,
    premium: p.basePremium ?? 0,
    stampDuty: p.stampDuty ?? 0,
    vat: p.vat ?? 0,
    total: row.ord.total,
    period: periodLabel(p.periodStart, p.periodEnd),
    termMonths: p.termMonths ?? 12,
    details: p.details ?? {},
    boundAt: `${longDate(boundAt)} · ${boundAt.toTimeString().slice(0, 8)}`,
    stage: policyStage(row.ord.stage, p.periodEnd),
    email: me.email,
    receipt: { ...receipt, total: row.ord.total },
    provider: "nem",
    providerRef: p.providerRef ?? null,
    naicomId: p.naicomId ?? null,
    externalCertificateUrl: p.certificateUrl && /^https?:\/\//.test(p.certificateUrl) ? p.certificateUrl : null,
    debitNoteUrl: p.debitNoteUrl ?? null,
    creditNoteUrl: p.creditNoteUrl ?? null,
  };
}

/* ───────────────────────── admin (all users) ───────────────────────── */

const ADMIN_SELECT = {
  ...CUSTOMER_SELECT,
  customer: user,
} as const;

function toAdminOrder(row: AdminRow): AdminOrder {
  const name = row.customer?.name ?? "—";
  const p = row.policy;
  return {
    id: row.ord.reference,
    date: shortDate(row.ord.createdAt),
    customer: name,
    customerId: row.ord.userId,
    customerInitials: initials(name),
    kind: "Insurance",
    item: itemLabel(row),
    qty: "1 policy",
    total: row.ord.total,
    stage: policyStage(row.ord.stage, p?.periodEnd ?? null),
    planId: row.plan?.reference ?? undefined,
    category: row.plan?.category ? insuranceCategory(row.plan.category) : undefined,
    underwriter: p?.underwriter ?? row.plan?.underwriter ?? "—",
    policyNo: p?.policyNo ?? "—",
    period: periodLabel(p?.periodStart ?? null, p?.periodEnd ?? null),
    termMonths: p?.termMonths ?? undefined,
    sumInsured: p?.sumInsured ?? undefined,
    premium: p?.basePremium ?? undefined,
    insuredParty: p?.insuredParty ?? name,
    provider: "nem",
    productCode:
      row.plan?.productCode === "mtp" || row.plan?.productCode === "comp" || row.plan?.productCode === "emtp"
        ? row.plan.productCode
        : null,
    providerRef: p?.providerRef ?? null,
    naicomId: p?.naicomId ?? null,
    certificateUrl: p?.certificateUrl ?? null,
    debitNoteUrl: p?.debitNoteUrl ?? null,
    creditNoteUrl: p?.creditNoteUrl ?? null,
    details: p?.details ?? null,
  };
}

/** Every policy across all users, newest first. */
export async function getAdminOrders(): Promise<AdminOrder[]> {
  const rows = await db
    .select(ADMIN_SELECT)
    .from(order)
    .leftJoin(insurancePolicy, eq(insurancePolicy.orderId, order.id))
    .leftJoin(insurancePlan, eq(insurancePlan.id, insurancePolicy.planId))
    .leftJoin(user, eq(user.id, order.userId))
    .orderBy(desc(order.createdAt));
  return rows.map(toAdminOrder);
}

/** Single policy by reference, across all users (admin scope). */
export async function getAdminOrder(id: string): Promise<AdminOrder | undefined> {
  const rows = await db
    .select(ADMIN_SELECT)
    .from(order)
    .leftJoin(insurancePolicy, eq(insurancePolicy.orderId, order.id))
    .leftJoin(insurancePlan, eq(insurancePlan.id, insurancePolicy.planId))
    .leftJoin(user, eq(user.id, order.userId))
    .where(eq(order.reference, id))
    .limit(1);
  const row = rows[0];
  return row ? toAdminOrder(row) : undefined;
}
