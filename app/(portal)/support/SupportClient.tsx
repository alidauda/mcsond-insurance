"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  PageHeading,
  Card,
  SectionLabel,
  Button,
  IconButton,
  Badge,
  Pill,
  cx,
  statusLabel,
  type BadgeTone,
} from "@/components/ui";
import { type CustomerTicket } from "@/lib/mock-data";
import { createTicket, replyToTicket, type SupportState } from "./actions";

/** Match the reference design: open→warning, in-review→neutral, resolved→success. */
function ticketTone(status: CustomerTicket["status"]): BadgeTone {
  switch (status) {
    case "open":
      return "warning";
    case "resolved":
      return "success";
    default:
      return "neutral";
  }
}

const inputCls =
  "h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink outline-none placeholder:text-faint focus:border-navy";

/** New-ticket form (toggled from the header / empty state). */
function NewTicketForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState<SupportState, FormData>(createTicket, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <Card className="p-6">
      <SectionLabel className="mb-4">New ticket</SectionLabel>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <SectionLabel className="mb-1.5">Subject</SectionLabel>
            <input name="subject" placeholder="Briefly, what's the issue?" className={inputCls} />
          </label>
          <label className="block">
            <SectionLabel className="mb-1.5">Topic</SectionLabel>
            <select name="channel" defaultValue="Insurance" className={inputCls}>
              <option value="Insurance">Insurance</option>
              <option value="Wallet">Wallet</option>
              <option value="Account">Account</option>
            </select>
          </label>
          <label className="flex items-end gap-2.5 pb-1.5">
            <input type="checkbox" name="priority" value="high" className="size-4 accent-[var(--color-crimson)]" />
            <span className="text-sm text-ink">High priority</span>
          </label>
        </div>
        <label className="block">
          <SectionLabel className="mb-1.5">Details</SectionLabel>
          <textarea
            name="body"
            rows={4}
            placeholder="Give us the details — policy number, what happened, what you need…"
            className="w-full resize-y rounded-[12px] border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-faint focus:border-navy"
          />
        </label>
        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" icon="plus" disabled={pending}>
            {pending ? "Opening…" : "Open ticket"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          {state && !state.ok && <p className="text-sm font-medium text-crimson">{state.message}</p>}
        </div>
      </form>
    </Card>
  );
}

/** Reply box for the selected ticket. */
function ReplyBox({ ticketId }: { ticketId: string }) {
  const [state, formAction, pending] = useActionState<SupportState, FormData>(replyToTicket, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="border-t border-line px-6 py-5">
      {/* Keyed so switching tickets clears the box. */}
      <input type="hidden" name="ticket" value={ticketId} />
      <textarea
        key={ticketId}
        name="body"
        placeholder="Type your reply…"
        rows={3}
        className="w-full resize-none rounded-[12px] border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-faint focus:border-navy"
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        {state && !state.ok ? (
          <p className="text-sm font-medium text-crimson">{state.message}</p>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}

export default function SupportClient({
  customerTickets,
}: {
  customerTickets: CustomerTicket[];
}) {
  const [selectedId, setSelectedId] = useState(customerTickets[0]?.id);
  const [showNew, setShowNew] = useState(false);
  const selected =
    customerTickets.find((t) => t.id === selectedId) ?? customerTickets[0];

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow={`SUPPORT · ${customerTickets.length} TICKETS`}
        title={
          <>
            How can we <em className="italic text-crimson">help?</em>
          </>
        }
        actions={
          <Button variant="primary" icon="plus" onClick={() => setShowNew(true)}>
            New ticket
          </Button>
        }
      />

      {showNew && <NewTicketForm onDone={() => setShowNew(false)} />}

      {customerTickets.length === 0 ? (
        !showNew && (
          <Card className="grid place-items-center px-6 py-20 text-center">
            <div className="max-w-sm space-y-3">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
                No tickets
              </p>
              <h2 className="font-serif text-2xl font-semibold text-navy">
                You&apos;re all caught up
              </h2>
              <p className="text-sm text-muted">
                You haven&apos;t opened any support tickets yet. Start one and our team
                will pick it up.
              </p>
              <Button variant="primary" icon="plus" className="mt-2" onClick={() => setShowNew(true)}>
                New ticket
              </Button>
            </div>
          </Card>
        )
      ) : (
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── LEFT · ticket list ── */}
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {customerTickets.map((ticket) => {
              const active = ticket.id === selectedId;
              return (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(ticket.id)}
                    className={cx(
                      "flex w-full items-start justify-between gap-3 border-l-2 px-5 py-4 text-left transition-colors",
                      active
                        ? "border-navy bg-navy/[0.04]"
                        : "border-transparent hover:bg-canvas",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
                        {ticket.id}
                      </p>
                      <p className="mt-1.5 truncate text-sm font-semibold text-ink">
                        {ticket.subject}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {ticket.channel} · {ticket.age}
                      </p>
                    </div>
                    <Badge
                      tone={ticketTone(ticket.status)}
                      mono
                      className="shrink-0"
                    >
                      {statusLabel(ticket.status)}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* ── RIGHT · conversation ── */}
        <Card className="flex flex-col">
          <div className="border-b border-line px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
                  {selected.id}
                </p>
                <h2 className="mt-1.5 font-serif text-2xl font-semibold text-navy">
                  {selected.subject}
                </h2>
              </div>
              <IconButton name="dots" label="Ticket options" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {selected.priority && (
                <Badge tone="danger" mono>
                  {selected.priority}
                </Badge>
              )}
              <Pill>{selected.channel}</Pill>
              <Pill>{selected.age}</Pill>
              <Badge tone={ticketTone(selected.status)} mono>
                {statusLabel(selected.status)}
              </Badge>
            </div>
          </div>

          {/* thread */}
          <div className="flex-1 space-y-4 px-6 py-6">
            {selected.thread && selected.thread.length > 0 ? (
              selected.thread.map((msg, i) => {
                const isOps = msg.role === "operations";
                return (
                  <div
                    key={i}
                    className={cx(
                      "rounded-[12px] px-4 py-3.5",
                      isOps
                        ? "border-l-2 border-crimson bg-danger-bg"
                        : "bg-surface-soft",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-ink">
                        {msg.author} · {msg.time}
                      </p>
                      <span
                        className={cx(
                          "font-mono text-[0.7rem] uppercase tracking-wide",
                          isOps ? "text-crimson" : "text-muted",
                        )}
                      >
                        {msg.role}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                      {msg.body}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="grid place-items-center rounded-[12px] border border-dashed border-line py-16 text-center">
                <p className="text-sm text-muted">
                  No messages yet. Start the conversation below.
                </p>
              </div>
            )}
          </div>

          {/* reply box */}
          <ReplyBox ticketId={selected.id} />
        </Card>
      </div>
      )}
    </div>
  );
}
