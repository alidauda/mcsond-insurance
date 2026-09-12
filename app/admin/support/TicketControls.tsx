"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Button, SectionLabel, cx } from "@/components/ui";
import {
  replyToTicketAdmin,
  resolveTicket,
  assignToMe,
  escalateTicket,
  issueTicketRefund,
  type SupportState,
} from "./actions";

/** Reply box with an optional staff-only internal-note toggle. */
export function TicketReply({ reference }: { reference: string }) {
  const [state, formAction, pending] = useActionState<SupportState, FormData>(
    replyToTicketAdmin,
    null,
  );

  return (
    <form action={formAction} className="mt-5">
      <input type="hidden" name="ticket" value={reference} />
      <textarea
        name="body"
        rows={4}
        placeholder="Reply to the customer…"
        className="w-full resize-y rounded-[12px] border border-line bg-surface p-4 text-sm text-ink outline-none placeholder:text-faint focus:border-navy/40"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="internal" value="true" className="size-4 accent-[var(--color-navy)]" />
          Internal note — not shown to the customer
        </label>
        <div className="flex items-center gap-3">
          {state && (
            <span className={cx("text-sm font-medium", state.ok ? "text-success" : "text-crimson")}>
              {state.message}
            </span>
          )}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Resolve / assign / escalate / refund controls. */
export function TicketActions({
  reference,
  canRefund,
}: {
  reference: string;
  canRefund: boolean;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [showRefund, setShowRefund] = useState(false);
  const [refundState, refundAction, refunding] = useActionState<SupportState, FormData>(
    issueTicketRefund,
    null,
  );
  const refundForm = useRef<HTMLFormElement>(null);
  // A successful refund closes the form, so a second click (or a browser retry
  // of the POST) can't repeat it. Derived rather than set from an effect, and
  // `reopened` lets the agent deliberately issue a further partial refund —
  // the server caps the total against what was actually paid either way.
  const [reopened, setReopened] = useState(0);
  const refundOpen = showRefund && !(refundState?.ok && reopened === 0);

  function run(fn: (ref: string) => Promise<SupportState>) {
    setNote(null);
    start(async () => {
      const r = await fn(reference);
      setNote(r?.message ?? null);
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      <Button
        variant="primary"
        icon="check"
        className="w-full justify-start"
        disabled={pending}
        onClick={() => run(resolveTicket)}
      >
        Mark resolved
      </Button>
      <Button
        variant="outline"
        icon="users"
        className="w-full justify-start"
        disabled={pending}
        onClick={() => run(assignToMe)}
      >
        Assign to me
      </Button>
      <Button
        variant="outline"
        icon="arrowUp"
        className="w-full justify-start"
        disabled={pending}
        onClick={() => run(escalateTicket)}
      >
        Escalate to finance
      </Button>

      {note && <p className="text-sm font-medium text-success">{note}</p>}

      {canRefund &&
        (refundOpen ? (
          <form ref={refundForm} action={refundAction} className="mt-1 space-y-2.5 rounded-[12px] border border-line p-3">
            <input type="hidden" name="ticket" value={reference} />
            <SectionLabel>Issue refund</SectionLabel>
            <input
              name="amount"
              inputMode="numeric"
              placeholder="Amount (₦)"
              className="h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 font-mono tnum text-sm text-ink outline-none focus:border-navy"
            />
            <input
              name="reason"
              placeholder="Reason (optional)"
              className="h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-navy"
            />
            {refundState && (
              <p className={cx("text-sm font-medium", refundState.ok ? "text-success" : "text-crimson")}>
                {refundState.message}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" variant="dangerSoft" icon="wallet" disabled={refunding}>
                {refunding ? "Refunding…" : "Confirm refund"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setReopened(0);
                  setShowRefund(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="dangerSoft"
            icon="wallet"
            className="w-full justify-start"
            onClick={() => {
              refundForm.current?.reset();
              setReopened((n) => n + 1);
              setShowRefund(true);
            }}
          >
            {refundState?.ok ? "Issue another refund" : "Issue refund"}
          </Button>
        ))}
    </div>
  );
}
