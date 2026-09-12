import "server-only";
import { desc, eq, lt, sql, type AnyColumn } from "drizzle-orm";
import { db } from "./db";
import { wallet, order, insurancePolicy, ledgerEntry, auditEntry, integration } from "./schema";
import { user } from "./auth-schema";
import { type Status } from "./mock-data";
import { nairaCompact } from "./format";

/* ───────────────────────── 09 · Admin overview ─────────────────────────
 * Everything on this page is derived from real rows. Where a figure needs
 * history (deltas, sparklines) it comes from bucketing createdAt columns —
 * there are no fixture numbers. An empty database yields zeros and empty
 * states rather than invented data.
 * ──────────────────────────────────────────────────────────────────────── */

export type Kpi = {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  trend: number[];
};

const MONTHS = 12;

/** ["2026-08", … ] — `n` month keys ending with the current month. */
function lastMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** First instant of the oldest month in the window. */
function windowStart(n: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1), 1));
}

type Bucket = { m: string; v: number };

/** Turn grouped rows into a dense series aligned to `keys` (missing = 0). */
function densify(keys: string[], rows: Bucket[]): number[] {
  const byKey = new Map(rows.map((r) => [r.m, Number(r.v ?? 0)]));
  return keys.map((k) => byKey.get(k) ?? 0);
}

/** Running total, seeded with an opening balance. */
function cumulative(series: number[], opening: number): number[] {
  let acc = opening;
  return series.map((v) => (acc += v));
}

/** "+12.4%" / "-3.1%" / "—" when there's no prior period to compare against. */
function pctDelta(current: number, previous: number): { delta: string; up: boolean } {
  if (previous === 0) return { delta: current === 0 ? "—" : "new", up: current >= 0 };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return { delta: `${rounded >= 0 ? "+" : ""}${rounded}%`, up: rounded >= 0 };
}

/**
 * KPI tiles — value, period-over-period delta and a 12-month sparkline, all
 * aggregated from the live tables.
 */
export async function getAdminKpis(): Promise<Kpi[]> {
  const keys = lastMonthKeys(MONTHS);
  const start = windowStart(MONTHS);

  const monthExpr = (col: AnyColumn) =>
    sql<string>`to_char(date_trunc('month', ${col}), 'YYYY-MM')`;

  const [
    ledgerByMonth,
    ledgerOpening,
    usersByMonth,
    usersOpening,
    gwpByMonth,
    policiesByMonth,
    floatRow,
    customersRow,
    gwpTotalRow,
    policiesTotalRow,
  ] = await Promise.all([
    db
      .select({ m: monthExpr(ledgerEntry.createdAt), v: sql<number>`coalesce(sum(${ledgerEntry.amount}), 0)::int` })
      .from(ledgerEntry)
      .groupBy(sql`date_trunc('month', ${ledgerEntry.createdAt})`),
    db
      .select({ v: sql<number>`coalesce(sum(${ledgerEntry.amount}), 0)::int` })
      .from(ledgerEntry)
      .where(lt(ledgerEntry.createdAt, start)),
    db
      .select({ m: monthExpr(user.createdAt), v: sql<number>`count(*)::int` })
      .from(user)
      .where(eq(user.role, "user"))
      .groupBy(sql`date_trunc('month', ${user.createdAt})`),
    db
      .select({ v: sql<number>`count(*)::int` })
      .from(user)
      .where(sql`${user.role} = 'user' and ${user.createdAt} < ${start}`),
    // Gross written premium per month (base premium of every bound policy).
    db
      .select({
        m: monthExpr(order.createdAt),
        v: sql<number>`coalesce(sum(${insurancePolicy.basePremium}), 0)::int`,
      })
      .from(insurancePolicy)
      .innerJoin(order, eq(insurancePolicy.orderId, order.id))
      .where(eq(order.kind, "insurance"))
      .groupBy(sql`date_trunc('month', ${order.createdAt})`),
    db
      .select({ m: monthExpr(order.createdAt), v: sql<number>`count(*)::int` })
      .from(order)
      .where(eq(order.kind, "insurance"))
      .groupBy(sql`date_trunc('month', ${order.createdAt})`),
    db.select({ v: sql<number>`coalesce(sum(${wallet.balance}), 0)::int` }).from(wallet),
    db.select({ v: sql<number>`count(*)::int` }).from(user).where(eq(user.role, "user")),
    db
      .select({ v: sql<number>`coalesce(sum(${insurancePolicy.basePremium}), 0)::int` })
      .from(insurancePolicy)
      .innerJoin(order, eq(insurancePolicy.orderId, order.id))
      .where(eq(order.kind, "insurance")),
    db.select({ v: sql<number>`count(*)::int` }).from(order).where(eq(order.kind, "insurance")),
  ]);

  const floatSeries = cumulative(densify(keys, ledgerByMonth), Number(ledgerOpening[0]?.v ?? 0));
  const userSeries = cumulative(densify(keys, usersByMonth), Number(usersOpening[0]?.v ?? 0));
  const gwpSeries = densify(keys, gwpByMonth);
  const policySeries = densify(keys, policiesByMonth);

  const floatTotal = Number(floatRow[0]?.v ?? 0);
  const customers = Number(customersRow[0]?.v ?? 0);
  const gwpTotal = Number(gwpTotalRow[0]?.v ?? 0);
  const policiesTotal = Number(policiesTotalRow[0]?.v ?? 0);

  const last = (s: number[]) => s[s.length - 1] ?? 0;
  const prev = (s: number[]) => s[s.length - 2] ?? 0;

  const floatDelta = pctDelta(floatTotal, prev(floatSeries));
  const newUsersThisMonth = last(userSeries) - prev(userSeries);
  const gwpDelta = pctDelta(last(gwpSeries), prev(gwpSeries));
  const policyDelta = pctDelta(last(policySeries), prev(policySeries));

  return [
    {
      label: "Wallet Float",
      value: nairaCompact(floatTotal),
      delta: floatDelta.delta,
      up: floatDelta.up,
      trend: floatSeries,
    },
    {
      label: "Active Users",
      value: customers.toLocaleString("en-NG"),
      delta: newUsersThisMonth > 0 ? `+${newUsersThisMonth} mo` : "—",
      up: newUsersThisMonth >= 0,
      trend: userSeries,
    },
    {
      label: "Insurance GWP",
      value: nairaCompact(gwpTotal),
      delta: gwpDelta.delta,
      up: gwpDelta.up,
      trend: gwpSeries,
    },
    {
      label: "Policies Bound",
      value: policiesTotal.toLocaleString("en-NG"),
      delta: policyDelta.delta,
      up: policyDelta.up,
      trend: policySeries,
    },
  ];
}

/* ── Volume by category ── */

export type VolumeSeries = { name: string; color: string };
export type VolumeDataset = { labels: string[]; data: [number, number][] };
export type VolumeByCategory = {
  series: VolumeSeries[];
  toggles: string[];
  activeToggle: string;
  /** One dataset per toggle, so the control actually switches real data. */
  datasets: Record<string, VolumeDataset>;
};

const VOLUME_SERIES: VolumeSeries[] = [
  { name: "Policies bound", color: "var(--color-crimson)" },
  { name: "Wallet ops", color: "#8a877f" },
];

/** Bucket a list of dates into `n` periods ending now. */
function bucketByPeriod(
  dates: Date[],
  n: number,
  granularity: "day" | "week" | "month",
): { labels: string[]; counts: number[] } {
  const now = new Date();
  const startOf = (d: Date): number => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    if (granularity === "week") x.setDate(x.getDate() - x.getDay());
    if (granularity === "month") x.setDate(1);
    return x.getTime();
  };
  const step = (base: Date, i: number): Date => {
    const x = new Date(base);
    if (granularity === "day") x.setDate(x.getDate() - i);
    if (granularity === "week") x.setDate(x.getDate() - i * 7);
    if (granularity === "month") x.setMonth(x.getMonth() - i);
    return x;
  };

  const periods: number[] = [];
  for (let i = n - 1; i >= 0; i--) periods.push(startOf(step(now, i)));

  const counts = new Array(n).fill(0) as number[];
  for (const d of dates) {
    const key = startOf(d);
    const idx = periods.indexOf(key);
    if (idx >= 0) counts[idx]++;
  }

  const labels = periods.map((t, i) => {
    const d = new Date(t);
    if (granularity === "day") return d.toLocaleDateString("en-US", { day: "2-digit" });
    if (granularity === "month") return d.toLocaleDateString("en-US", { month: "short" });
    return `W${i + 1}`;
  });

  return { labels, counts };
}

/**
 * Weekly/daily/monthly volume of policies bound vs wallet operations, computed
 * from createdAt. All three datasets are returned so the Daily/Weekly/Monthly
 * control switches between real series.
 */
export async function getVolumeByCategory(): Promise<VolumeByCategory> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  const [orderRows, walletOpRows] = await Promise.all([
    db
      .select({ at: order.createdAt })
      .from(order)
      .where(sql`${order.kind} = 'insurance' and ${order.createdAt} >= ${since}`),
    db
      .select({ at: ledgerEntry.createdAt })
      .from(ledgerEntry)
      .where(sql`${ledgerEntry.type} <> 'insurance' and ${ledgerEntry.createdAt} >= ${since}`),
  ]);

  const orderDates = orderRows.map((r) => new Date(r.at));
  const walletDates = walletOpRows.map((r) => new Date(r.at));

  const build = (n: number, g: "day" | "week" | "month"): VolumeDataset => {
    const a = bucketByPeriod(orderDates, n, g);
    const b = bucketByPeriod(walletDates, n, g);
    return {
      labels: a.labels,
      data: a.counts.map((v, i) => [v, b.counts[i] ?? 0] as [number, number]),
    };
  };

  return {
    series: VOLUME_SERIES.map((s) => ({ ...s })),
    toggles: ["Daily", "Weekly", "Monthly"],
    activeToggle: "Weekly",
    datasets: {
      Daily: build(14, "day"),
      Weekly: build(12, "week"),
      Monthly: build(12, "month"),
    },
  };
}

/* ── GWP by underwriter ── */

export type GwpSlice = { label: string; value: number; color: string; amount: number };

const GWP_PALETTE = ["var(--color-crimson)", "#1a1917", "#8a877f", "#a6791f", "#2f7d54", "#2e2e6b"];

/** Trim long underwriter names to the short label used by the legend. */
function shortUnderwriter(name: string): string {
  return name.split(/\s|&/)[0] || name;
}

/**
 * Premium share by underwriter across every bound policy. Returns an empty
 * list (not fixture slices) when no policies exist yet.
 */
export async function getGwpByUnderwriter(): Promise<GwpSlice[]> {
  const rows = await db
    .select({
      underwriter: insurancePolicy.underwriter,
      total: sql<number>`coalesce(sum(${insurancePolicy.basePremium}), 0)::int`,
    })
    .from(insurancePolicy)
    .innerJoin(order, eq(insurancePolicy.orderId, order.id))
    .where(eq(order.kind, "insurance"))
    .groupBy(insurancePolicy.underwriter)
    .orderBy(desc(sql`coalesce(sum(${insurancePolicy.basePremium}), 0)`));

  const grand = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  if (!rows.length || grand <= 0) return [];

  return rows.map((r, i) => ({
    label: shortUnderwriter(r.underwriter ?? "—"),
    amount: Number(r.total ?? 0),
    value: Math.round((Number(r.total ?? 0) / grand) * 100),
    color: GWP_PALETTE[i % GWP_PALETTE.length],
  }));
}

/* ── Live activity + service health ── */

export type LiveEvent = { time: string; text: string };

/** Most recent audit entries. Empty when nothing has happened yet. */
export async function getLiveEvents(): Promise<LiveEvent[]> {
  const rows = await db
    .select({
      action: auditEntry.action,
      targetRef: auditEntry.targetRef,
      detail: auditEntry.detail,
      createdAt: auditEntry.createdAt,
    })
    .from(auditEntry)
    .orderBy(desc(auditEntry.createdAt))
    .limit(4);

  return rows.map((r) => ({
    time: hhmm(r.createdAt),
    text: [r.action, r.targetRef, r.detail].filter(Boolean).join(" · "),
  }));
}

function hhmm(d: unknown): string {
  const date = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toTimeString().slice(0, 5);
}

export type ServiceHealth = { name: string; status: Status };

/** Configured integrations. Empty until some are registered. */
export async function getServiceHealth(): Promise<ServiceHealth[]> {
  const rows = await db
    .select({ name: integration.name, status: integration.status })
    .from(integration);

  return rows.map((r) => ({
    name: r.name ?? "—",
    status: healthStatus(r.status),
  }));
}

function healthStatus(v: unknown): Status {
  return v === "live" || v === "attention" ? v : "attention";
}
