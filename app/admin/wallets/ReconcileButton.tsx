"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { reconcileTopups, type ReconcileState } from "./actions";

/** One-click safety net: settles pending Paystack top-ups via the verify API. */
export function ReconcileButton() {
  const [state, formAction, pending] = useActionState<ReconcileState, FormData>(
    () => reconcileTopups(),
    null,
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Reconciling…" : "Reconcile top-ups"}
      </Button>
      {state && (
        <span className="max-w-64 text-xs text-muted">{state.message}</span>
      )}
    </form>
  );
}
