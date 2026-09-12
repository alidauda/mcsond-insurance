"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { paystackTransaction } from "@/lib/schema";
import { requireCustomer } from "@/lib/server-session";
import { initializeTransaction, PaystackNetworkError } from "@/lib/paystack";
import { naira } from "@/lib/format";

export type TopupState = { ok: boolean; message: string } | null;

// Paystack test cards clear small charges fine, so keep the floor low (₦100)
// for ngrok testing; the cap guards against typos, not business rules.
const MIN_TOPUP = 100;
const MAX_TOPUP = 10_000_000;

/**
 * Start a wallet top-up: record a pending paystack_transaction, initialize the
 * charge server-side, and redirect the customer to Paystack's checkout page.
 * The wallet is credited later by the webhook/callback verify — never here.
 */
export async function startTopup(_prev: TopupState, formData: FormData): Promise<TopupState> {
  const me = await requireCustomer();

  const raw = String(formData.get("amount") ?? "").replace(/[,\s₦]/g, "");
  const amount = Number(raw);
  if (!Number.isInteger(amount) || amount < MIN_TOPUP) {
    return { ok: false, message: `Enter a whole amount of at least ${naira(MIN_TOPUP)}.` };
  }
  if (amount > MAX_TOPUP) {
    return { ok: false, message: `Top-ups are capped at ${naira(MAX_TOPUP)} per transaction.` };
  }

  const reference = `PSK-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  await db.insert(paystackTransaction).values({
    reference,
    userId: me.id,
    amount,
    status: "pending",
  });

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  let authorizationUrl: string;
  try {
    ({ authorizationUrl } = await initializeTransaction({
      email: me.email,
      amountNaira: amount,
      reference,
      callbackUrl: `${baseUrl}/wallet/topup/callback`,
      metadata: { userId: me.id, purpose: "wallet-topup" },
    }));
  } catch (err) {
    await db
      .update(paystackTransaction)
      .set({
        status: "failed",
        gatewayResponse: err instanceof Error ? err.message : "initialize failed",
        updatedAt: new Date(),
      })
      .where(eq(paystackTransaction.reference, reference));
    return {
      ok: false,
      message:
        err instanceof PaystackNetworkError
          ? "Network hiccup reaching Paystack (local security software sometimes drops the connection) — tap Top up again."
          : "Paystack rejected the request — check the secret key (Admin → Settings) and the amount, then try again.",
    };
  }

  redirect(authorizationUrl);
}
