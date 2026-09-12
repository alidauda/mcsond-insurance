import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  Eyebrow,
  SectionLabel,
  Badge,
  Avatar,
  Divider,
  cx,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { ProgressBar } from "@/components/charts";
import {
  getQueueTicket,
  getTicketThread,
  getQueueUserId,
  getQueueOrderId,
} from "@/lib/support";
import { getUserDetail } from "@/lib/admin-users";
import { TicketReply, TicketActions } from "../TicketControls";

// Request-time only (no generateStaticParams): data depends on the live DB and
// the caller's session.
export const dynamic = "force-dynamic";

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getQueueTicket(id);
  if (!ticket) notFound();
  const thread = await getTicketThread(ticket.id, ticket.subject);
  const [queueUserId, queueOrderId] = await Promise.all([
    getQueueUserId(),
    getQueueOrderId(),
  ]);
  const userId = queueUserId[ticket.id];
  const account = userId ? await getUserDetail(userId) : null;
  const relatedOrder = queueOrderId[ticket.id];
  const atRisk = ticket.sla > 0.7;

  return (
    <div className="flex flex-col gap-7">
      <Link
        href="/admin/support"
        className="inline-flex w-fit items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted hover:text-ink"
      >
        <Icon name="arrowRight" className="size-4 rotate-180" />
        Support inbox
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Eyebrow className="mb-2">{ticket.id}</Eyebrow>
          <h1 className="font-serif text-3xl font-semibold text-navy">{ticket.subject}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Badge tone="neutral" dot mono>
              {ticket.type}
            </Badge>
            <Badge tone={ticket.priority === "High" ? "danger" : "neutral"} dot>
              {ticket.priority} priority
            </Badge>
            {atRisk && (
              <Badge tone="danger" mono>
                SLA at risk
              </Badge>
            )}
            <span className="font-mono text-xs text-faint">updated {ticket.updated}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Conversation ── */}
        <Card className="flex flex-col p-6 lg:col-span-2">
          <div className="flex flex-col gap-4">
            {thread.map((m, i) => {
              const ops = m.role === "operations";
              const internal = !!m.internal;
              return (
                <div
                  key={i}
                  className={cx(
                    "rounded-[12px] p-4",
                    internal
                      ? "border border-dashed border-warning/50 bg-warning-bg"
                      : ops
                        ? "border-l-2 border-crimson bg-danger-bg"
                        : "bg-surface-soft",
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">
                      {m.author} · {m.time}
                    </span>
                    <span
                      className={cx(
                        "font-mono text-[0.62rem] uppercase tracking-[0.14em]",
                        internal ? "text-warning" : ops ? "text-crimson" : "text-faint",
                      )}
                    >
                      {internal ? "internal note" : ops ? "operations" : "customer"}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-soft">{m.body}</p>
                </div>
              );
            })}
          </div>

          <TicketReply reference={ticket.id} />
        </Card>

        {/* ── Meta + actions ── */}
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <SectionLabel>Requester</SectionLabel>
            {account ? (
              <Link
                href={`/admin/users/${account.id}`}
                className="mt-4 flex items-center gap-3 rounded-[10px] border border-line p-3 transition-colors hover:bg-canvas"
              >
                <Avatar initials={account.initials} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{account.name}</p>
                  <p className="truncate font-mono text-[0.68rem] text-faint">{account.id}</p>
                </div>
                <Icon name="chevronRight" className="size-4 text-faint" />
              </Link>
            ) : (
              <p className="mt-3 text-sm text-ink">{ticket.user}</p>
            )}

            {relatedOrder && (
              <Link
                href={`/admin/orders/${relatedOrder}`}
                className="mt-3 flex items-center justify-between gap-3 rounded-[10px] border border-line p-3 transition-colors hover:bg-canvas"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-navy/5 text-navy">
                    <Icon name="receipt" className="size-4" />
                  </span>
                  <div>
                    <p className="font-mono text-[0.68rem] text-faint">Related order</p>
                    <p className="text-sm font-semibold text-ink">{relatedOrder}</p>
                  </div>
                </div>
                <Icon name="chevronRight" className="size-4 text-faint" />
              </Link>
            )}

            <Divider className="my-5" />

            <dl className="flex flex-col gap-3 text-sm">
              <Meta label="Type" value={ticket.type} />
              <Meta label="Priority" value={`${ticket.priority}`} />
              <Meta label="Assigned" value={ticket.assigned} />
              <Meta label="Updated" value={ticket.updated} />
            </dl>

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between font-mono text-[0.66rem] uppercase tracking-[0.12em] text-faint">
                <span>SLA</span>
                <span className={atRisk ? "text-crimson" : "text-muted"}>
                  {Math.round(ticket.sla * 100)}% elapsed
                </span>
              </div>
              <ProgressBar
                value={ticket.sla * 100}
                color={atRisk ? "var(--color-crimson)" : "var(--color-navy)"}
              />
            </div>
          </Card>

          <Card className="p-6">
            <SectionLabel>Actions</SectionLabel>
            <TicketActions
              reference={ticket.id}
              canRefund={ticket.type === "Insurance" || ticket.type === "Wallet"}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
