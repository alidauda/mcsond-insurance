"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/server-session";
import { reconcilePendingTopups } from "@/lib/wallet-mutations";

export type ReconcileState = { ok: boolean; message: string } | null;

/** Settle pending Paystack top-ups against the verify API (finance: wallet.adjust). */
export async function reconcileTopups(): Promise<ReconcileState> {
  await requirePermission({ wallet: ["adjust"] });

  // Keep the 10-minute floor from reconcilePendingTopups. Sweeping a checkout
  // the customer is still on makes Paystack report it "abandoned", which used
  // to write it off before they had finished paying.
  const r = await reconcilePendingTopups();
  revalidatePath("/admin/wallets");
  revalidatePath("/wallet");

  if (r.checked === 0) {
    return { ok: true, message: "No top-ups older than 10 minutes are awaiting settlement." };
  }
  const recovered = r.recovered > 0 ? `, ${r.recovered} recovered` : "";
  return {
    ok: true,
    message: `Checked ${r.checked}: ${r.credited} credited${recovered}, ${r.markedFailed} marked failed, ${r.stillPending} still pending.`,
  };
}
