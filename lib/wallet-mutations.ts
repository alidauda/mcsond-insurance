import "server-only";
import { randomUUID, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "./db";
import { wallet, ledgerEntry, paystackTransaction } from "./schema";
import { verifyTransaction, TERMINAL_FAILURE_STATUSES } from "./paystack";

/**
 * Ledger engine. Every kobo that moves goes through applyWalletMovement inside
 * a DB transaction: the wallet row is locked (SELECT … FOR UPDATE), the cached
 * balance is updated, and an append-only ledger_entry records the movement with
 * balanceBefore → runningBalance (after). Errors are thrown with stable codes
 * (INSUFFICIENT_FUNDS) so actions can map them to friendly messages.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class InsufficientFundsError extends Error {
  constructor(public shortfall: number) {
    super("INSUFFICIENT_FUNDS");
  }
}

function newWalletReference(): string {
  return `MSC-WLT-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/**
 * Ledger reference, e.g. TXN-3F9A2C7B41. Drawn from a 40-bit space and checked
 * against the table inside the caller's transaction, because a six-digit random
 * collides at ~1,180 entries by the birthday bound and the column is a customer
 * -visible identifier support uses to find a movement.
 */
async function newTxnReference(tx: Tx): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const ref = `TXN-${randomBytes(5).toString("hex").toUpperCase()}`;
    const clash = await tx
      .select({ id: ledgerEntry.id })
      .from(ledgerEntry)
      .where(eq(ledgerEntry.reference, ref))
      .limit(1);
    if (!clash[0]) return ref;
  }
  return `TXN-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

/** Lock (and lazily create) the user's wallet row for this transaction. */
async function lockWallet(tx: Tx, userId: string) {
  const locked = await tx
    .select()
    .from(wallet)
    .where(eq(wallet.userId, userId))
    .limit(1)
    .for("update");
  if (locked[0]) return locked[0];

  // First movement for this user — create the wallet, tolerating a concurrent
  // creator (unique userId), then lock whichever row won.
  await tx
    .insert(wallet)
    .values({ id: randomUUID(), reference: newWalletReference(), userId })
    .onConflictDoNothing({ target: wallet.userId });
  const created = await tx
    .select()
    .from(wallet)
    .where(eq(wallet.userId, userId))
    .limit(1)
    .for("update");
  return created[0];
}

export type WalletMovement = {
  userId: string;
  /** Signed integer Naira. Positive = inflow, negative = outflow. */
  amount: number;
  /** insurance | topup | refund | adjustment */
  type: string;
  description: string;
  reference?: string;
  orderId?: string | null;
  createdBy?: string | null;
};

export type PostedMovement = {
  reference: string;
  balanceBefore: number;
  balanceAfter: number;
};

/** Post one wallet movement. Must run inside an open transaction. */
export async function applyWalletMovement(tx: Tx, m: WalletMovement): Promise<PostedMovement> {
  if (!Number.isInteger(m.amount) || m.amount === 0) {
    throw new Error("Movement amount must be a non-zero integer.");
  }
  const w = await lockWallet(tx, m.userId);
  const balanceBefore = w.balance;
  const balanceAfter = balanceBefore + m.amount;
  if (balanceAfter < 0) throw new InsufficientFundsError(-balanceAfter);
  // Earmarked funds are shown to the customer as reserved, so honour that:
  // an outflow may not eat into them. Inflows are always allowed.
  const reserved = w.earmarked ?? 0;
  if (m.amount < 0 && reserved > 0 && balanceAfter < reserved) {
    throw new InsufficientFundsError(reserved - balanceAfter);
  }

  await tx
    .update(wallet)
    .set({ balance: balanceAfter, updatedAt: new Date() })
    .where(eq(wallet.id, w.id));

  const reference = m.reference ?? (await newTxnReference(tx));
  await tx.insert(ledgerEntry).values({
    id: randomUUID(),
    walletId: w.id,
    userId: m.userId,
    reference,
    type: m.type,
    description: m.description,
    amount: m.amount,
    balanceBefore,
    runningBalance: balanceAfter,
    orderId: m.orderId ?? null,
    createdBy: m.createdBy ?? null,
  });

  return { reference, balanceBefore, balanceAfter };
}

/* ───────────────────────── Paystack top-ups ───────────────────────── */

export type TopupCreditResult =
  | "credited"
  | "recovered"
  | "already-processed"
  | "unknown-reference";

/**
 * Credit a successful Paystack charge to the payer's wallet — idempotent.
 * Both the callback page and the webhook call this.
 *
 * The gate claims any row that is not already `success`, so **only a credited
 * row is terminal**. A row we previously marked `failed` — because the customer
 * bounced back mid-transfer, or an admin swept it — is still credited when the
 * real `charge.success` lands. Treating `failed` as terminal loses the
 * customer's money permanently and silently, which is exactly what this gate
 * exists to prevent. The `WHERE status <> 'success' … RETURNING` remains a
 * single atomic claim, so a webhook/callback race still credits exactly once.
 */
export async function creditPaystackTopup(params: {
  reference: string;
  paidKobo: number;
  channel?: string | null;
  gatewayResponse?: string | null;
  paidAt?: string | null;
}): Promise<TopupCreditResult> {
  return db.transaction(async (tx) => {
    // Lock the row before reading its status, so the state we decide on is the
    // state we act on. This is what serialises a concurrent webhook and
    // callback: the loser blocks here, then sees "success" and does nothing.
    const [row] = await tx
      .select()
      .from(paystackTransaction)
      .where(eq(paystackTransaction.reference, params.reference))
      .limit(1)
      .for("update");

    if (!row) return "unknown-reference"; // not one of our top-ups
    if (row.status === "success") return "already-processed";

    // Anything else — pending, or a row an earlier step wrote off as failed —
    // is still creditable. Only a credited row is terminal.
    const recovered = row.status !== "pending";

    await tx
      .update(paystackTransaction)
      .set({
        status: "success",
        channel: params.channel ?? null,
        gatewayResponse: params.gatewayResponse ?? null,
        paidAt: params.paidAt ? new Date(params.paidAt) : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paystackTransaction.id, row.id));

    // Paystack reports the GROSS amount the customer paid. Accounts configured
    // to pass processing fees to the customer report requested + fee (e.g.
    // ₦252,000 for a ₦250,000 top-up) — but settlement to the merchant is the
    // requested amount, so that's what the wallet gets. Cap at the request;
    // credit less only if the customer somehow paid less (partial payment).
    const amountNaira = Math.min(Math.floor(params.paidKobo / 100), row.amount);
    await applyWalletMovement(tx, {
      userId: row.userId,
      amount: amountNaira,
      type: "topup",
      description: `Wallet top-up · Paystack${params.channel ? ` · ${params.channel}` : ""}`,
    });

    if (recovered) {
      // Loud on purpose: a customer nearly lost this money, and whatever wrote
      // the row off (callback on an in-flight status, an over-eager sweep)
      // needs finding.
      console.warn(
        `[wallet] RECOVERED top-up ${params.reference}: credited ₦${amountNaira.toLocaleString("en-NG")} to a transaction previously marked "${row.status}".`,
      );
      return "recovered";
    }
    return "credited";
  });
}

export type ReconcileResult = {
  checked: number;
  credited: number;
  /** Credited despite having been written off earlier — worth investigating. */
  recovered: number;
  markedFailed: number;
  stillPending: number;
};

/**
 * Sweep pending paystack_transactions and settle them against Paystack's
 * verify endpoint — the safety net for top-ups whose webhook AND callback were
 * both missed (server restart, tunnel down). Crediting goes through the same
 * idempotent gate as the webhook, so re-running is always safe.
 */
export async function reconcilePendingTopups(opts?: {
  olderThanMinutes?: number;
}): Promise<ReconcileResult> {
  const cutoff = new Date(Date.now() - (opts?.olderThanMinutes ?? 10) * 60_000);
  const pendings = await db
    .select()
    .from(paystackTransaction)
    .where(
      and(
        eq(paystackTransaction.status, "pending"),
        lt(paystackTransaction.createdAt, cutoff),
      ),
    );

  const result: ReconcileResult = {
    checked: pendings.length,
    credited: 0,
    recovered: 0,
    markedFailed: 0,
    stillPending: 0,
  };

  for (const p of pendings) {
    let verified;
    try {
      verified = await verifyTransaction(p.reference);
    } catch {
      result.stillPending++; // network hiccup or not-yet-known ref — retry later
      continue;
    }
    if (verified.status === "success" && verified.currency === "NGN") {
      const outcome = await creditPaystackTopup({
        reference: p.reference,
        paidKobo: verified.amountKobo,
        channel: verified.channel,
        gatewayResponse: verified.gatewayResponse,
        paidAt: verified.paidAt,
      });
      if (outcome === "credited") result.credited++;
      if (outcome === "recovered") result.recovered++;
    } else if (TERMINAL_FAILURE_STATUSES.has(verified.status)) {
      await markTopupFailed(p.reference, verified.gatewayResponse ?? verified.status);
      result.markedFailed++;
    } else {
      result.stillPending++; // e.g. still ongoing at Paystack
    }
  }
  return result;
}

/** Mark a pending top-up failed (verify said failed/abandoned). No-op otherwise. */
export async function markTopupFailed(reference: string, reason: string | null): Promise<void> {
  await db
    .update(paystackTransaction)
    .set({ status: "failed", gatewayResponse: reason, updatedAt: new Date() })
    .where(
      and(
        eq(paystackTransaction.reference, reference),
        eq(paystackTransaction.status, "pending"),
      ),
    );
}
