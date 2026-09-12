"use client";

import { useActionState, useState } from "react";
import { Button, cx } from "@/components/ui";
import { startTopup, type TopupState } from "./actions";

const QUICK_AMOUNTS = [500, 5_000, 50_000, 250_000];

/** Amount entry → server action → redirect to Paystack checkout. */
export function TopUpForm() {
  const [state, formAction, pending] = useActionState<TopupState, FormData>(startTopup, null);
  const [amount, setAmount] = useState("5000");

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_AMOUNTS.map((v) => {
          const active = amount === String(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              className={cx(
                "rounded-full border px-3 py-1.5 font-mono text-xs tracking-wide transition-colors",
                active
                  ? "border-navy bg-navy text-surface"
                  : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              ₦{v.toLocaleString("en-NG")}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-serif text-ink-soft">
            ₦
          </span>
          <input
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ""))}
            inputMode="numeric"
            aria-label="Top-up amount in Naira"
            className="h-12 w-full rounded-[10px] border border-line bg-surface pl-9 pr-4 font-mono tnum text-sm text-ink outline-none focus:border-navy"
          />
        </div>
        <Button type="submit" variant="primary" icon="plus" disabled={pending}>
          {pending ? "Starting…" : "Top up"}
        </Button>
      </div>

      {state && !state.ok && <p className="text-sm text-crimson">{state.message}</p>}
      <p className="text-xs text-muted">Secured by Paystack — you’ll be redirected to pay.</p>
    </form>
  );
}
