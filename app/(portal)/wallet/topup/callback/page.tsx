import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireCustomer } from "@/lib/server-session";
import { db } from "@/lib/db";
import { paystackTransaction } from "@/lib/schema";
import { verifyTransaction, TERMINAL_FAILURE_STATUSES } from "@/lib/paystack";
import { creditPaystackTopup, markTopupFailed } from "@/lib/wallet-mutations";

/**
 * Paystack sends the customer back here after checkout with ?reference=…
 * (and legacy ?trxref=…). We re-verify server-side — the redirect itself
 * proves nothing — then credit idempotently (the webhook may have won the
 * race already; creditPaystackTopup handles that) and bounce to /wallet.
 */
export default async function TopupCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const me = await requireCustomer();
  const sp = await searchParams;
  const reference = sp.reference ?? sp.trxref;
  if (!reference) redirect("/wallet");

  // The reference comes from the URL, so confirm it is this customer's before
  // acting on it. Otherwise anyone signed in could read another person's
  // payment state, or write off their in-flight top-up.
  const [owned] = await db
    .select({ userId: paystackTransaction.userId })
    .from(paystackTransaction)
    .where(eq(paystackTransaction.reference, reference))
    .limit(1);
  if (!owned || owned.userId !== me.id) redirect("/wallet");

  let outcome: "success" | "failed" | "pending" | "error" = "error";
  try {
    const verified = await verifyTransaction(reference);
    if (verified.status === "success" && verified.currency === "NGN") {
      await creditPaystackTopup({
        reference,
        paidKobo: verified.amountKobo,
        channel: verified.channel,
        gatewayResponse: verified.gatewayResponse,
        paidAt: verified.paidAt,
      });
      outcome = "success";
    } else if (TERMINAL_FAILURE_STATUSES.has(verified.status)) {
      // Only a genuinely dead payment is written off. Bank transfer and USSD
      // report "ongoing"/"pending" here while the money is still moving;
      // failing those would strand a payment the customer has already made.
      await markTopupFailed(reference, verified.gatewayResponse ?? verified.status);
      outcome = "failed";
    } else {
      outcome = "pending";
    }
  } catch {
    outcome = "error";
  }

  redirect(`/wallet?topup=${outcome}`);
}
