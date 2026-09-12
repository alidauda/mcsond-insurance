import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  Eyebrow,
  SectionLabel,
  Button,
  Badge,
  Money,
  Divider,
  statusTone,
  statusLabel,
  cx,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { getOrder, getOrderDetail } from "@/lib/orders";
import { naira } from "@/lib/format";

// Request-time only: data depends on the live DB and the caller's session.
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const detail = await getOrderDetail(order);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/orders"
        className="inline-flex w-fit items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted hover:text-ink"
      >
        <Icon name="arrowRight" className="size-4 rotate-180" />
        Policies &amp; receipts
      </Link>

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Eyebrow className="mb-2">Policy · {order.id}</Eyebrow>
          <h1 className="font-serif text-3xl font-semibold text-navy">{order.item}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Badge tone={statusTone(order.status)} mono>
              {statusLabel(order.status)}
            </Badge>
            <span className="text-sm text-muted">Bound {order.date}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {detail.hasCertificate && detail.certificateHref && (
            <Button variant="primary" icon="shieldCheck" href={detail.certificateHref}>
              View certificate
            </Button>
          )}
          <Button variant="outline" icon="download">
            Download receipt
          </Button>
          {order.status === "renew" && (
            <Button variant="accent" icon="shield" href="/insurance">
              Renew cover
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left · 2 cols ── */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Progress timeline */}
          <Card className="p-6">
            <SectionLabel>Policy progress</SectionLabel>
            <ol className="mt-6 flex flex-col gap-0 sm:flex-row sm:gap-0">
              {detail.steps.map((s, i) => {
                const last = i === detail.steps.length - 1;
                return (
                  <li key={s.label} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
                    <div className="flex flex-col items-center sm:w-full sm:flex-row">
                      <span
                        className={cx(
                          "grid size-7 shrink-0 place-items-center rounded-full border text-xs",
                          s.done
                            ? "border-success bg-success text-surface"
                            : s.active
                              ? "border-crimson bg-crimson text-surface"
                              : "border-line bg-surface text-faint",
                        )}
                      >
                        {s.done ? <Icon name="check" className="size-4" /> : i + 1}
                      </span>
                      {!last && (
                        <span className={cx("ml-3 hidden h-0.5 flex-1 sm:block", s.done ? "bg-success" : "bg-line")} />
                      )}
                    </div>
                    <p
                      className={cx(
                        "pb-5 text-sm sm:pb-0 sm:pt-3",
                        s.active ? "font-medium text-crimson" : s.done ? "text-ink" : "text-faint",
                      )}
                    >
                      {s.label}
                    </p>
                  </li>
                );
              })}
            </ol>
            {order.status === "cancelled" && (
              <p className="mt-4 rounded-[10px] bg-danger-bg px-4 py-3 text-sm text-crimson">
                This policy was cancelled and the premium refunded to your wallet.
              </p>
            )}
            {order.status === "failed" && (
              <p className="mt-4 rounded-[10px] bg-danger-bg px-4 py-3 text-sm text-crimson">
                The underwriter declined this policy. Nothing was charged — the premium was refunded to your wallet.
              </p>
            )}
            {order.status === "pending" && (
              <p className="mt-4 rounded-[10px] bg-warning-bg px-4 py-3 text-sm text-warning">
                Waiting for the underwriter to confirm. Refresh in a moment.
              </p>
            )}
            {order.status === "renew" && (
              <p className="mt-4 rounded-[10px] bg-warning-bg px-4 py-3 text-sm text-warning">
                <Icon name="bell" className="mr-2 inline size-4" />
                Cover ends soon — renew to stay protected without a gap.
              </p>
            )}
          </Card>

          {/* Policy details */}
          <Card className="p-6">
            <SectionLabel className="mb-5">Policy details</SectionLabel>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <Field label="Underwriter" value={detail.underwriter ?? "—"} />
              <Field label="Policy no." value={detail.policyNo ?? "—"} mono />
              <Field label="Period" value={detail.period ?? "—"} className="col-span-2 sm:col-span-1" />
              <Field label="Class" value={detail.category ?? "—"} />
              {detail.provider === "nem" && <Field label="Issued via" value="NEM eInsurance API" />}
              {detail.providerRef && <Field label="Underwriter ref" value={detail.providerRef} mono />}
              <Field label="Sum insured" value={detail.sumInsured ? naira(detail.sumInsured) : "—"} />
              <Field label="Premium" value={detail.premium ? naira(detail.premium) : naira(order.total)} />
            </dl>
          </Card>
        </div>

        {/* ── Right · receipt ── */}
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <SectionLabel>Receipt</SectionLabel>
            <dl className="mt-5 flex flex-col gap-3.5 text-sm">
              <Row label="Reference" value={detail.receipt.reference} mono />
              <Row label="Date" value={detail.receipt.date} />
              <Row label="Paid from" value={detail.receipt.paidFrom} mono />
            </dl>
            <Divider className="my-5" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-ink">Total paid</span>
              <Money value={detail.receipt.total} className="text-2xl" />
            </div>
          </Card>

          <Card className="p-6">
            <SectionLabel>Need help?</SectionLabel>
            <p className="mt-3 text-sm text-muted">
              Need a certificate reissued or a detail corrected? Open a ticket and our team will sort it.
            </p>
            <Button variant="outline" icon="ticket" href="/support" className="mt-4 w-full">
              Open a ticket
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-faint">{label}</dt>
      <dd className={cx("mt-1 text-sm text-ink", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cx("text-ink", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
