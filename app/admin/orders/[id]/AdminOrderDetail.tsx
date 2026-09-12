"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Card,
  Eyebrow,
  SectionLabel,
  Button,
  Badge,
  Avatar,
  Money,
  Divider,
  statusLabel,
  cx,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { orderStageTone, type AdminOrder } from "@/lib/mock-data";
import { naira } from "@/lib/format";
import { cancelPolicy, type PolicyActionState } from "../actions";

const POLICY_STEPS = ["Quote requested", "Paid", "Policy bound", "Certificate issued"];

export function AdminOrderDetail({
  order,
  customerName,
  customerEmail,
  customerInitials,
}: {
  order: AdminOrder;
  customerName: string;
  customerEmail: string;
  customerInitials: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PolicyActionState>(null);
  const [confirming, setConfirming] = useState(false);
  const cancelled = order.stage === "cancelled";
  const dead = cancelled || order.stage === "failed";
  const external = order.certificateUrl && /^https?:\/\//.test(order.certificateUrl) ? order.certificateUrl : null;
  const vehicleRows = order.details
    ? (
        [
          ["Plate", order.details.plate],
          ["Vehicle type", order.details.vehicleType],
          ["Usage", order.details.usage],
          ["Year", order.details.year],
          ["Colour", order.details.color],
          ["Engine no.", order.details.engineNo],
          ["Chassis no.", order.details.chassisNo],
          ["Variant", order.details.variant],
          ["Vehicle value", order.details.vehicleValue ? naira(Number(order.details.vehicleValue)) : undefined],
          ["Excess buy-back", order.details.excessBuyBack],
          ["Inspection", order.details.inspectionAddress ? `${order.details.inspectionAddress} · ${order.details.inspectionDate}` : undefined],
        ] as [string, string | undefined][]
      ).filter((r): r is [string, string] => !!r[1])
    : [];

  function runCancel() {
    setResult(null);
    start(async () => {
      const r = await cancelPolicy(order.id);
      setResult(r);
      setConfirming(false);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/admin/orders"
        className="inline-flex w-fit items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted hover:text-ink"
      >
        <Icon name="arrowRight" className="size-4 rotate-180" />
        Policy book
      </Link>

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Eyebrow className="mb-2">Policy · {order.id}</Eyebrow>
          <h1 className="font-serif text-3xl font-semibold text-navy">{order.item}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Badge tone={orderStageTone(order.stage)} mono>
              {statusLabel(order.stage)}
            </Badge>
            <span className="text-sm text-muted">Bound {order.date}</span>
          </div>
        </div>
      </div>

      {result && (
        <div
          className={cx(
            "flex items-center gap-2.5 rounded-[12px] border px-4 py-3 text-sm",
            result.ok
              ? "border-success/30 bg-success-bg text-success"
              : "border-crimson/30 bg-danger-bg text-crimson",
          )}
        >
          <Icon name={result.ok ? "check" : "ban"} className="size-4" />
          {result.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left · 2 cols ── */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Lifecycle */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionLabel>Lifecycle</SectionLabel>
              {cancelled ? (
                <Badge tone="danger" mono>
                  Cancelled
                </Badge>
              ) : order.stage === "failed" ? (
                <Badge tone="danger" mono>
                  Underwriter declined · refunded
                </Badge>
              ) : order.stage === "pending" ? (
                <Badge tone="warning" mono>
                  Awaiting underwriter
                </Badge>
              ) : order.stage === "renew" ? (
                <Badge tone="warning" mono>
                  Renewal due
                </Badge>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <Icon name="check" className="size-4" /> Certificate issued
                </span>
              )}
            </div>

            <ol className="mt-7 flex flex-col gap-0 sm:flex-row">
              {POLICY_STEPS.map((label, i) => {
                const done = dead ? i < (order.stage === "failed" ? 1 : 2) : order.stage === "pending" ? i < 2 : true;
                const last = i === POLICY_STEPS.length - 1;
                return (
                  <li key={label} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
                    <div className="flex flex-col items-center sm:w-full sm:flex-row">
                      <span
                        className={cx(
                          "grid size-7 shrink-0 place-items-center rounded-full border text-xs",
                          done ? "border-success bg-success text-surface" : "border-line bg-surface text-faint",
                        )}
                      >
                        {done ? <Icon name="check" className="size-4" /> : i + 1}
                      </span>
                      {!last && (
                        <span className={cx("ml-3 hidden h-0.5 flex-1 sm:block", done ? "bg-success" : "bg-line")} />
                      )}
                    </div>
                    <p className={cx("pb-5 text-sm sm:pb-0 sm:pt-3", done ? "text-ink" : "text-faint")}>{label}</p>
                  </li>
                );
              })}
            </ol>

            {cancelled && (
              <p className="mt-5 rounded-[10px] bg-danger-bg px-4 py-3 text-sm text-crimson">
                This policy was cancelled. The customer was refunded to their wallet.
              </p>
            )}
            {order.stage === "failed" && (
              <p className="mt-5 rounded-[10px] bg-danger-bg px-4 py-3 text-sm text-crimson">
                The underwriter declined this policy. The customer was refunded automatically.
              </p>
            )}
          </Card>

          {(order.provider === "nem" || order.providerRef) && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionLabel>Underwriter · NEM eInsurance</SectionLabel>
                <Badge tone="info" dot mono>
                  {order.productCode ? order.productCode.toUpperCase() : "NEM"}
                </Badge>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                <Field label="Transaction ref" value={order.providerRef ?? "—"} mono className="col-span-2 sm:col-span-1" />
                <Field label="NAICOM ID" value={order.naicomId ?? "—"} mono />
                <Field label="Policy no. (NEM)" value={order.policyNo ?? "—"} mono />
                {vehicleRows.map(([l, v]) => (
                  <Field key={l} label={l} value={v} />
                ))}
              </dl>
              {(external || order.debitNoteUrl || order.creditNoteUrl) && (
                <>
                  <Divider className="my-5" />
                  <div className="flex flex-wrap gap-2.5 text-sm">
                    {external && (
                      <a href={external} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-navy hover:bg-canvas">
                        <Icon name="file" className="size-4" /> Certificate
                      </a>
                    )}
                    {order.debitNoteUrl && (
                      <a href={order.debitNoteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-navy hover:bg-canvas">
                        <Icon name="file" className="size-4" /> Debit note
                      </a>
                    )}
                    {order.creditNoteUrl && (
                      <a href={order.creditNoteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-navy hover:bg-canvas">
                        <Icon name="file" className="size-4" /> Credit note
                      </a>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Policy */}
          <Card className="p-6">
            <SectionLabel className="mb-5">Policy</SectionLabel>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <Field label="Underwriter" value={order.underwriter ?? "—"} />
              <Field label="Policy no." value={order.policyNo ?? "—"} mono />
              <Field label="Period" value={order.period ?? "—"} className="col-span-2 sm:col-span-1" />
              <Field label="Insured party" value={order.insuredParty ?? customerName} />
              <Field label="Class" value={order.category ?? "—"} />
              <Field label="Term" value={order.termMonths ? `${order.termMonths} months` : "—"} />
              <Field label="Sum insured" value={order.sumInsured ? naira(order.sumInsured) : "—"} />
              <Field label="Premium" value={order.premium ? naira(order.premium) : naira(order.total)} />
              <Field label="Status" value={statusLabel(order.stage)} />
            </dl>
            <Divider className="my-6" />
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" icon="download" disabled={cancelled}>
                Reissue certificate
              </Button>
              <Button variant="outline" icon="external">
                Underwriter portal
              </Button>
            </div>
          </Card>
        </div>

        {/* ── Right · customer + payment + danger ── */}
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <SectionLabel>Customer</SectionLabel>
            <Link
              href={`/admin/users/${order.customerId}`}
              className="mt-4 flex items-center gap-3 rounded-[10px] border border-line p-3 transition-colors hover:bg-canvas"
            >
              <Avatar initials={customerInitials} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{customerName}</p>
                <p className="truncate font-mono text-[0.68rem] text-faint">{customerEmail || order.customerId}</p>
              </div>
              <Icon name="chevronRight" className="size-4 text-faint" />
            </Link>
          </Card>

          <Card className="p-6">
            <SectionLabel>Payment</SectionLabel>
            <dl className="mt-5 flex flex-col gap-3.5 text-sm">
              <Row label="Method" value="Wallet" />
              <Row label="Status" value={dead ? "Refunded" : order.stage === "pending" ? "Reserved" : "Settled"} />
              <Row label="Premium" value={naira(order.premium ?? order.total)} />
            </dl>
            <Divider className="my-5" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-ink">Total paid</span>
              <Money value={order.total} className="text-2xl" />
            </div>
          </Card>

          {!dead && order.stage !== "pending" && (
            <Card className="p-6">
              <SectionLabel>Danger zone</SectionLabel>
              <p className="mt-3 text-sm text-muted">
                Cancelling refunds the full amount paid ({naira(order.total)}) to the customer&apos;s wallet and
                voids the certificate.
              </p>
              {confirming ? (
                <div className="mt-4 flex flex-col gap-2">
                  <Button variant="danger" icon="minus" onClick={runCancel} disabled={pending} className="w-full">
                    {pending ? "Cancelling…" : "Confirm cancel & refund"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending} className="w-full">
                    Keep policy
                  </Button>
                </div>
              ) : (
                <Button variant="dangerSoft" icon="minus" onClick={() => setConfirming(true)} className="mt-4 w-full">
                  Cancel &amp; refund policy
                </Button>
              )}
            </Card>
          )}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
