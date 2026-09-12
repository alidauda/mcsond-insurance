"use client";

import { useActionState, useState, useTransition } from "react";
import { Card, SectionLabel, Button, Badge, Divider, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import { decideKycReview, runKycForUser } from "@/app/admin/users/actions";
import type { KycEvidence, KycAttempt, AttemptIdentity } from "@/lib/kyc";
import type { KycStatus } from "@/lib/mock-data";

const inputCls =
  "h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 font-mono text-sm text-ink outline-none focus:border-navy";

const TONE: Record<KycStatus, "success" | "warning" | "danger"> = {
  verified: "success",
  pending: "warning",
  unverified: "danger",
};

const AUTO_VERIFY_SCORE = 85;

/** KYC evidence, identity comparison, biometric photo and review controls. */
export function KycPanel({
  userId,
  accountName,
  status,
  evidence,
  latest,
  attempts,
  photo,
  canViewPhoto,
}: {
  userId: string;
  accountName: string;
  status: KycStatus;
  evidence: KycEvidence | null;
  latest: AttemptIdentity | null;
  attempts: KycAttempt[];
  photo: string | null;
  canViewPhoto: boolean;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [runState, runAction, running] = useActionState(runKycForUser, null);

  // Prefer the stored profile; fall back to the last attempt so a failed or
  // pending check still shows what the register actually returned.
  const record = {
    fullName: evidence?.verifiedName ?? latest?.fullName ?? null,
    dateOfBirth: evidence?.verifiedDob ?? latest?.dateOfBirth ?? null,
    gender: evidence?.verifiedGender ?? latest?.gender ?? null,
    birthState: evidence?.verifiedState ?? latest?.birthState ?? null,
    phone: evidence?.verifiedPhone ?? latest?.phone ?? null,
    ninMasked: evidence?.ninMasked ?? latest?.ninMasked ?? null,
    method: evidence?.methodLabel ?? latest?.methodLabel ?? null,
  };
  const score = evidence?.nameMatchScore ?? latest?.nameMatchScore ?? null;
  const hasRecord = !!record.fullName;
  const mismatch = score !== null && score < AUTO_VERIFY_SCORE;
  const verified = status === "verified";

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>Identity verification · SwiftCheck</SectionLabel>
        <Badge tone={TONE[status]}>{status}</Badge>
      </div>

      {/* ── Identity comparison (always shown once anything came back) ── */}
      {hasRecord ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr]">
          {/* NIMC photograph */}
          <div className="flex flex-col items-center gap-2">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt={`NIMC photograph of ${record.fullName}`}
                className="size-28 rounded-[12px] border border-line object-cover"
              />
            ) : (
              <div className="grid size-28 place-items-center rounded-[12px] border border-dashed border-line bg-surface-soft text-center">
                <span className="px-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-faint">
                  {!canViewPhoto ? "Restricted" : evidence?.photoOnFile ? "No image" : "No photo"}
                </span>
              </div>
            )}
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-faint">
              {canViewPhoto ? "NIMC photo" : "KYC role only"}
            </span>
          </div>

          {/* Side-by-side fields */}
          <div>
            <div className="grid grid-cols-[1fr_1fr] gap-x-4 border-b border-line pb-2">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">National record</span>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">This account</span>
            </div>
            <Compare label="Name" left={record.fullName} right={accountName} highlight={mismatch} />
            <Compare label="Date of birth" left={record.dateOfBirth} right="—" />
            <Compare label="Gender" left={record.gender} right="—" />
            <Compare label="Phone" left={record.phone} right="—" />
            <Compare label="State of origin" left={record.birthState} right="—" />
            <Compare label="NIN" left={record.ninMasked} right="—" mono />
            <Compare label="Method" left={record.method} right={latest?.at ?? evidence?.verifiedAt ?? "—"} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No identity check on file yet. Run one below, or the customer can verify themselves.
        </p>
      )}

      {/* ── Match verdict ── */}
      {score !== null && (
        <div
          className={cx(
            "mt-4 flex items-center gap-2.5 rounded-[10px] px-4 py-3 text-sm",
            mismatch ? "bg-warning-bg text-warning" : "bg-success-bg text-success",
          )}
        >
          <Icon name={mismatch ? "bell" : "check"} className="size-4 shrink-0" />
          <span>
            Name match <strong>{score}%</strong>
            {mismatch
              ? ` — below the ${AUTO_VERIFY_SCORE}% automatic threshold, so this needs a human decision.`
              : " — cleared automatically."}
          </span>
        </div>
      )}

      {/* ── Review decision ── */}
      {hasRecord && !verified && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            icon="check"
            disabled={pending}
            onClick={() => start(async () => setNote((await decideKycReview(userId, "approve"))?.message ?? null))}
          >
            Approve identity
          </Button>
          <Button
            variant="dangerSoft"
            icon="ban"
            disabled={pending}
            onClick={() => start(async () => setNote((await decideKycReview(userId, "reject"))?.message ?? null))}
          >
            Reject
          </Button>
          <span className="text-xs text-muted">Rejecting clears the stored photograph.</span>
        </div>
      )}
      {note && <p className="mt-3 text-sm font-medium text-success">{note}</p>}

      {/* ── Run a check (always available, always open when unverified) ── */}
      <Divider className="my-5" />
      <form action={runAction} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />
        <SectionLabel>{verified ? "Re-run an identity check" : "Run a check for this customer"}</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
          <select name="method" defaultValue="phone" className={inputCls}>
            <option value="phone">Phone number</option>
            <option value="nin">NIN</option>
            <option value="shareCode">Share code</option>
          </select>
          <input name="value" placeholder="08034821190" className={inputCls} />
          <Button type="submit" variant="secondary" icon="shieldCheck" disabled={running}>
            {running ? "Checking…" : "Run check"}
          </Button>
        </div>
        {runState && (
          <p
            className={cx(
              "text-sm font-medium",
              runState.outcome === "verified"
                ? "text-success"
                : runState.outcome === "review"
                  ? "text-warning"
                  : "text-crimson",
            )}
          >
            {runState.message}
          </p>
        )}
        <p className="text-xs text-faint">
          Only run a check with details the customer has given you. Every lookup is logged against your account.
        </p>
      </form>

      {/* ── History (always shown) ── */}
      <Divider className="my-5" />
      <SectionLabel>Check history</SectionLabel>
      {attempts.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No checks have been run for this customer.</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {attempts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2.5 text-sm last:border-0"
            >
              <span className="font-medium text-ink">{a.methodLabel}</span>
              <span className="font-mono text-[0.68rem] text-faint">{a.at}</span>
              <span className="text-muted">{a.nameMatchScore !== null ? `${a.nameMatchScore}% match` : "no match run"}</span>
              <Badge tone={a.outcome === "verified" ? "success" : a.outcome === "review" ? "warning" : "danger"} mono>
                {a.outcome}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Compare({
  label,
  left,
  right,
  mono,
  highlight,
}: {
  label: string;
  left: string | null;
  right: string | null;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="border-b border-line-soft py-2 last:border-0">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-faint">{label}</p>
      <div className="mt-1 grid grid-cols-[1fr_1fr] gap-x-4">
        <span className={cx("text-sm", mono && "font-mono", highlight ? "font-semibold text-warning" : "text-ink")}>
          {left ?? "—"}
        </span>
        <span className={cx("text-sm", mono && "font-mono", highlight ? "font-semibold text-warning" : "text-ink-soft")}>
          {right ?? "—"}
        </span>
      </div>
    </div>
  );
}
