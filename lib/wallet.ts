import "server-only";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { wallet, ledgerEntry, order, insurancePolicy } from "./schema";
import { user } from "./auth-schema";
import { requireCustomer, requireStaff } from "./server-session";
import { type LedgerEntry } from "./mock-data";
import { nairaCompact } from "./format";
import { RENEWAL_WINDOW_DAYS } from "./quote";

export type WalletStats = {
  available: number;
  spentThisMonth: number;
  earmarked: number;
  earmarkedNote: string;
  /** 12-month outflow sparkline. */
  spendTrend: number[];
};

export type AdminWalletsView = {
  floatLabel: string;
  tiles: { label: string; value: string; delta: string; up: boolean }[];
  topBalances: { name: string; id: string; initials: string; amount: number }[];
};

/* ───────────────────────── helpers ───────────────────────── */

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** "May 04, 2026" — matches the LedgerEntry.date shape in mock-data. */
function ledgerDate(d: unknown): string {
  return new Date(d as string).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/** Map a stored ledger `type` to the LedgerEntry display union. */
function ledgerType(t: string): LedgerEntry["type"] {
  switch (t) {
    case "insurance":
      return "Insurance";
    default:
      // topup | refund | adjustment all surface as wallet movements
      return "Wallet top-up";
  }
}

/* ───────────────────────── customer-scoped ───────────────────────── */

/** Current customer's available wallet balance (integer Naira). */
export async function getWalletBalance(): Promise<number> {
  const me = await requireCustomer();
  const rows = await db
    .select({ balance: wallet.balance })
    .from(wallet)
    .where(eq(wallet.userId, me.id))
    .limit(1);
  return rows[0]?.balance ?? 0;
}

/** Current customer's wallet reference (e.g. MSC-WLT-2049-Z), if a wallet exists yet. */
export async function getWalletReference(): Promise<string | null> {
  const me = await requireCustomer();
  const rows = await db
    .select({ reference: wallet.reference })
    .from(wallet)
    .where(eq(wallet.userId, me.id))
    .limit(1);
  return rows[0]?.reference ?? null;
}

/** Current customer's ledger, newest first. Same shape as mock `ledger`. */
export async function getLedger(): Promise<LedgerEntry[]> {
  const me = await requireCustomer();
  const rows = await db
    .select({
      ref: ledgerEntry.reference,
      date: ledgerEntry.createdAt,
      type: ledgerEntry.type,
      description: ledgerEntry.description,
      amount: ledgerEntry.amount,
      balanceBefore: ledgerEntry.balanceBefore,
      runningBalance: ledgerEntry.runningBalance,
    })
    .from(ledgerEntry)
    .where(eq(ledgerEntry.userId, me.id))
    .orderBy(desc(ledgerEntry.createdAt), desc(ledgerEntry.id));

  return rows.map((r) => ({
    ref: r.ref ?? "",
    date: ledgerDate(r.date),
    type: ledgerType(r.type),
    description: r.description ?? "",
    amount: r.amount,
    // Legacy rows predate the balanceBefore column; derive it per-row.
    balanceBefore: r.balanceBefore ?? r.runningBalance - r.amount,
    runningBalance: r.runningBalance,
  }));
}

/** Current customer's wallet tiles. Same shape as mock `walletStats`. */
export async function getWalletStats(): Promise<WalletStats> {
  const me = await requireCustomer();

  const walletRows = await db
    .select({ balance: wallet.balance, earmarked: wallet.earmarked })
    .from(wallet)
    .where(eq(wallet.userId, me.id))
    .limit(1);
  const w = walletRows[0];
  const available = w?.balance ?? 0;
  const earmarked = w?.earmarked ?? 0;

  // Debits in the current calendar month (negative amounts) → "spent this month".
  const spentRows = await db
    .select({
      spent: sql<number>`coalesce(sum(case when ${ledgerEntry.amount} < 0 then -${ledgerEntry.amount} else 0 end), 0)`,
    })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, me.id),
        sql`date_trunc('month', ${ledgerEntry.createdAt}) = date_trunc('month', now())`,
      ),
    );
  const spentThisMonth = Number(spentRows[0]?.spent ?? 0);

  // 12-month outflow sparkline, bucketed from this customer's own ledger.
  const trendRows = await db
    .select({
      m: sql<string>`to_char(date_trunc('month', ${ledgerEntry.createdAt}), 'YYYY-MM')`,
      v: sql<number>`coalesce(sum(case when ${ledgerEntry.amount} < 0 then -${ledgerEntry.amount} else 0 end), 0)::int`,
    })
    .from(ledgerEntry)
    .where(eq(ledgerEntry.userId, me.id))
    .groupBy(sql`date_trunc('month', ${ledgerEntry.createdAt})`);

  const byMonth = new Map(trendRows.map((r) => [r.m, Number(r.v ?? 0)]));
  const now = new Date();
  const spendTrend: number[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    spendTrend.push(byMonth.get(key) ?? 0);
  }

  // Policies due for renewal soon — what the earmarked funds are expected to cover.
  const renewBy = new Date(Date.now() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(order)
    .innerJoin(insurancePolicy, eq(insurancePolicy.orderId, order.id))
    .where(
      sql`${order.userId} = ${me.id} and ${order.stage} = 'active' and ${insurancePolicy.periodEnd} between now() and ${renewBy}`,
    );
  const pendingCount = Number(pending?.n ?? 0);

  return {
    available,
    spentThisMonth,
    earmarked,
    earmarkedNote:
      pendingCount > 0
        ? `${pendingCount} polic${pendingCount === 1 ? "y" : "ies"} renewing soon`
        : "Nothing reserved",
    spendTrend,
  };
}

/* ───────────────────────── admin ───────────────────────── */

/** Admin wallets view: float tiles + top balances, all from live rows. */
export async function getAdminWallets(): Promise<AdminWalletsView> {
  // Layouts aren't a security boundary — enforce staff here too.
  await requireStaff();

  // Total float across all customer wallets.
  const floatRows = await db
    .select({
      total: sql<number>`coalesce(sum(${wallet.balance}), 0)`,
    })
    .from(wallet);
  const totalFloat = Number(floatRows[0]?.total ?? 0);

  // Top customer balances.
  const topRows = await db
    .select({
      name: user.name,
      reference: wallet.reference,
      amount: wallet.balance,
    })
    .from(wallet)
    .innerJoin(user, eq(user.id, wallet.userId))
    .orderBy(desc(wallet.balance))
    .limit(5);

  const topBalances = topRows.map((r) => ({
    name: r.name,
    id: r.reference,
    initials: initials(r.name),
    amount: r.amount,
  }));

  // Today's money movement, straight off the append-only ledger.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [flow] = await db
    .select({
      inflow: sql<number>`coalesce(sum(case when ${ledgerEntry.amount} > 0 then ${ledgerEntry.amount} else 0 end), 0)`,
      outflow: sql<number>`coalesce(sum(case when ${ledgerEntry.amount} < 0 then -${ledgerEntry.amount} else 0 end), 0)`,
    })
    .from(ledgerEntry)
    .where(gte(ledgerEntry.createdAt, startOfToday));
  const inflow = Number(flow?.inflow ?? 0);
  const outflow = Number(flow?.outflow ?? 0);

  // Reconciliation, per wallet. A single global sum lets two wallets that are
  // wrong in opposite directions cancel out and report "reconciled", which is
  // exactly the case finance needs to see.
  const perWallet = await db
    .select({
      walletId: wallet.id,
      balance: wallet.balance,
      ledger: sql<number>`coalesce(sum(${ledgerEntry.amount}), 0)::int`,
    })
    .from(wallet)
    .leftJoin(ledgerEntry, eq(ledgerEntry.walletId, wallet.id))
    .groupBy(wallet.id, wallet.balance);

  const mismatched = perWallet.filter((w) => w.balance !== Number(w.ledger));
  // Report the total absolute drift so offsetting errors add up instead of
  // cancelling.
  const variance = mismatched.reduce((sum, w) => sum + Math.abs(w.balance - Number(w.ledger)), 0);

  return {
    floatLabel: nairaCompact(totalFloat),
    tiles: [
      { label: "Total Float", value: nairaCompact(totalFloat), delta: "all wallets", up: true },
      { label: "Inflow Today", value: nairaCompact(inflow), delta: "today", up: true },
      { label: "Outflow Today", value: nairaCompact(outflow), delta: "today", up: false },
      {
        label: "Variance",
        value: nairaCompact(variance),
        delta:
          mismatched.length === 0
            ? "reconciled"
            : `${mismatched.length} wallet${mismatched.length === 1 ? "" : "s"} out of sync`,
        up: mismatched.length === 0,
      },
    ],
    topBalances,
  };
}
