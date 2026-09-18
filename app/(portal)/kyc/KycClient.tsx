"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/icons";
import { PageHeading, Card, SectionLabel, Button, Badge, Divider, cx } from "@/components/ui";
import type { KycEvidence, KycAttempt, DeclaredIdentity } from "@/lib/kyc";
import { isDeclarationComplete } from "@/lib/kyc-shared";
import type { KycMethod } from "@/lib/swiftcheck";
import type { KycStatus } from "@/lib/mock-data";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import { verifyIdentity, saveIdentityDetails, type KycState, type DetailsState } from "./actions";

const inputCls =
  "h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-navy";

const METHOD_COPY: Record<KycMethod, { label: string; blurb: string; icon: "shieldCheck" | "wallet" | "ticket" | "users" }> = {
  nin: { label: "NIN", blurb: "Your 11-digit National Identification Number.", icon: "shieldCheck" },
  phone: { label: "Phone number", blurb: "The number your NIN is registered against.", icon: "wallet" },
  shareCode: { label: "Share code", blurb: "Generated in the NIMC mobile app.", icon: "ticket" },
  demography: { label: "Name & date of birth", blurb: "We'll search the national register.", icon: "users" },
};

const STATUS_COPY: Record<KycStatus, { tone: "success" | "warning" | "danger"; title: string; body: string }> = {
  verified: {
    tone: "success",
    title: "Identity verified",
    body: "Your account is fully activated — you can bind policies without limits.",
  },
  pending: {
    tone: "warning",
    title: "Awaiting review",
    body: "We found your record but the name didn't match closely enough to clear automatically. A reviewer is checking it.",
  },
  unverified: {
    tone: "danger",
    title: "Not verified",
    body: "Nigerian insurance regulations require us to confirm your identity before you can bind cover.",
  },
};

export default function KycClient({
  accountName,
  status,
  evidence,
  attempts,
  methods,
  declared,
}: {
  accountName: string;
  status: KycStatus;
  evidence: KycEvidence | null;
  attempts: KycAttempt[];
  methods: KycMethod[];
  declared: DeclaredIdentity;
}) {
  const [method, setMethod] = useState<KycMethod>(methods[0] ?? "phone");
  const [state, formAction, pending] = useActionState<KycState, FormData>(verifyIdentity, null);
  const [detailsState, detailsAction, savingDetails] = useActionState<DetailsState, FormData>(saveIdentityDetails, null);
  const detailsComplete = isDeclarationComplete(declared);
  // Show the form when nothing is on file yet, or the customer asked to edit.
  const [editingDetails, setEditingDetails] = useState(!detailsComplete);

  // The action's own result wins over the page's snapshot after a submit.
  const current: KycStatus =
    state?.outcome === "verified" ? "verified" : state?.outcome === "review" ? "pending" : status;
  const s = STATUS_COPY[current];

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow="Identity verification"
        title={
          <>
            Confirm it&rsquo;s <em className="italic text-crimson">you.</em>
          </>
        }
        description="We check your details against Nigeria's national identity register. It takes a few seconds and only needs doing once."
      />

      {/* ── Status banner ── */}
      <Card
        className={cx(
          "flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between",
          current === "verified" && "border-success/30 bg-success-bg",
          current === "pending" && "border-warning/30 bg-warning-bg",
        )}
      >
        <div className="flex items-start gap-3">
          <Icon
            name={current === "verified" ? "shieldCheck" : current === "pending" ? "bell" : "shield"}
            className={cx(
              "mt-0.5 size-5 shrink-0",
              current === "verified" ? "text-success" : current === "pending" ? "text-warning" : "text-crimson",
            )}
          />
          <div>
            <p className="font-serif text-lg font-semibold text-navy">{s.title}</p>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">{s.body}</p>
          </div>
        </div>
        <Badge tone={s.tone}>{current}</Badge>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* ── Step 1 · who we're verifying ── */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionLabel>Step 1 · Your details</SectionLabel>
              {detailsComplete && current === "unverified" && !editingDetails && (
                <button type="button" onClick={() => setEditingDetails(true)} className="text-sm font-medium text-navy hover:underline">
                  Edit
                </button>
              )}
              {current !== "unverified" && <Badge tone="neutral">Locked</Badge>}
            </div>
            <p className="mt-2 max-w-xl text-sm text-ink-soft">
              Tell us who you are first. We compare these with the national record, so a matching name alone can
              never claim someone else&rsquo;s identity.
            </p>

            {editingDetails && current === "unverified" ? (
              <form action={detailsAction} className="mt-5 flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field2 label="Full name (from your Google account)">
                    <input value={accountName} readOnly className={cx(inputCls, "bg-surface-soft text-muted")} />
                    <Hint>Must match your NIN exactly. Change it in your Google account if it doesn&rsquo;t.</Hint>
                  </Field2>
                  <Field2 label="Phone number">
                    <input name="phone" type="tel" maxLength={14} placeholder="08034821190" defaultValue={declared.phone ?? ""} required className={cx(inputCls, "font-mono tnum")} />
                  </Field2>
                  <Field2 label="Date of birth">
                    <input name="dateOfBirth" type="date" defaultValue={declared.dateOfBirth ?? ""} required className={inputCls} />
                  </Field2>
                  <Field2 label="Gender">
                    <select name="gender" defaultValue={declared.gender ?? ""} required className={inputCls}>
                      <option value="" disabled>Choose…</option>
                      <option value="f">Female</option>
                      <option value="m">Male</option>
                    </select>
                  </Field2>
                  <Field2 label="State of origin">
                    <select name="stateOfOrigin" defaultValue={declared.stateOfOrigin ?? ""} required className={inputCls}>
                      <option value="" disabled>Choose…</option>
                      {NIGERIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </Field2>
                </div>
                {detailsState && (
                  <p className={cx("text-sm font-medium", detailsState.ok ? "text-success" : "text-crimson")}>{detailsState.message}</p>
                )}
                <div className="flex items-center gap-3">
                  <Button type="submit" variant="primary" icon="check" disabled={savingDetails}>
                    {savingDetails ? "Saving…" : "Save details"}
                  </Button>
                  {detailsComplete && (
                    <button type="button" onClick={() => setEditingDetails(false)} className="text-sm text-muted hover:underline">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                <Field label="Name" value={accountName} />
                <Field label="Phone" value={declared.phone ?? "—"} mono />
                <Field label="Date of birth" value={declared.dateOfBirth ?? "—"} />
                <Field label="Gender" value={declared.gender === "m" ? "Male" : declared.gender === "f" ? "Female" : "—"} />
                <Field label="State of origin" value={declared.stateOfOrigin ?? "—"} />
              </dl>
            )}
          </Card>

          {/* ── Step 2 · the check ── */}
          {current === "verified" ? (
            <Card className="p-6">
              <SectionLabel>Verified identity</SectionLabel>
              {evidence ? (
                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                  <Field label="Name on record" value={evidence.verifiedName ?? "—"} />
                  <Field label="NIN" value={evidence.ninMasked ?? "—"} mono />
                  <Field label="Date of birth" value={evidence.verifiedDob ?? "—"} />
                  <Field label="Method" value={evidence.methodLabel ?? "—"} />
                  <Field label="Verified" value={evidence.verifiedAt ?? "—"} />
                  <Field label="Reference" value={evidence.requestId ?? "—"} mono />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-muted">Your identity is confirmed.</p>
              )}
              <Divider className="my-6" />
              <Button variant="primary" icon="shield" href="/insurance">
                Buy cover →
              </Button>
            </Card>
          ) : (
            <Card className={cx("p-6", !detailsComplete && "opacity-60")}>
              <SectionLabel className="mb-4">Step 2 · How would you like to verify?</SectionLabel>
              {!detailsComplete && (
                <p className="mb-4 rounded-[10px] bg-warning-bg px-4 py-3 text-sm text-warning">
                  Save your details above first — the check compares them with the national record.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {methods.map((m) => {
                  const on = m === method;
                  const copy = METHOD_COPY[m];
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      aria-pressed={on}
                      className={cx(
                        "flex items-start gap-3 rounded-[12px] border p-4 text-left transition-colors",
                        on ? "border-navy bg-navy/[0.04] ring-2 ring-navy" : "border-line hover:bg-canvas",
                      )}
                    >
                      <Icon name={copy.icon} className={cx("mt-0.5 size-5 shrink-0", on ? "text-navy" : "text-faint")} />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{copy.label}</span>
                        <span className="mt-0.5 block text-xs text-muted">{copy.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <Divider className="my-6" />

              <form action={formAction} className="flex flex-col gap-5">
                <input type="hidden" name="method" value={method} />

                {method === "nin" && (
                  <Field2 label="National Identification Number">
                    <input
                      name="nin"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="12345678901"
                      required
                      className={cx(inputCls, "font-mono tnum tracking-wider")}
                    />
                    <Hint>Dial *346# on your registered line if you don&rsquo;t know your NIN.</Hint>
                  </Field2>
                )}

                {method === "phone" && (
                  <Field2 label="Registered phone number">
                    <input
                      name="phone"
                      type="tel"
                      maxLength={11}
                      placeholder="08034821190"
                      required
                      className={cx(inputCls, "font-mono tnum")}
                    />
                    <Hint>Must be the SIM your NIN is registered against.</Hint>
                  </Field2>
                )}

                {method === "shareCode" && (
                  <Field2 label="NIMC share code">
                    <input
                      name="shareCode"
                      placeholder="ABC123"
                      required
                      className={cx(inputCls, "font-mono uppercase tracking-wider")}
                    />
                    <Hint>Open the NIMC app, tap &ldquo;Share my NIN&rdquo; and enter the code shown.</Hint>
                  </Field2>
                )}

                {method === "demography" && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field2 label="First name">
                      <input name="firstName" defaultValue={accountName.split(" ")[0]} required className={inputCls} />
                    </Field2>
                    <Field2 label="Last name">
                      <input
                        name="lastName"
                        defaultValue={accountName.split(" ").slice(1).join(" ")}
                        required
                        className={inputCls}
                      />
                    </Field2>
                    <Field2 label="Date of birth">
                      <input name="dateOfBirth" type="date" required className={inputCls} />
                    </Field2>
                    <Field2 label="Gender">
                      <select name="gender" defaultValue="f" className={inputCls}>
                        <option value="f">Female</option>
                        <option value="m">Male</option>
                      </select>
                    </Field2>
                  </div>
                )}

                <div className="rounded-[12px] bg-surface-soft p-4 text-xs leading-relaxed text-muted">
                  <p className="flex items-center gap-2 font-medium text-ink">
                    <Icon name="lock" className="size-4 text-navy" /> How we handle your data
                  </p>
                  <p className="mt-2">
                    We check your details against the national identity register for the purpose of insurance
                    onboarding, as permitted under the NDPA. We never store your full NIN or your photograph —
                    only a masked reference and the result. Submitting is your consent to this check.
                  </p>
                </div>

                {state && (
                  <p
                    className={cx(
                      "text-sm font-medium",
                      state.outcome === "verified"
                        ? "text-success"
                        : state.outcome === "review"
                          ? "text-warning"
                          : "text-crimson",
                    )}
                  >
                    {state.message}
                  </p>
                )}

                <div className="flex items-center gap-4">
                  <Button type="submit" variant="primary" icon="shieldCheck" disabled={pending || !detailsComplete}>
                    {pending ? "Checking…" : "Verify my identity"}
                  </Button>
                  {/* Score only on a positive outcome — on a failure it would tell an
                      impostor how close their guess was. */}
                  {state?.outcome !== "failed" && state?.nameMatchScore !== null && state?.nameMatchScore !== undefined && (
                    <span className="text-sm text-muted">Name match {state.nameMatchScore}%</span>
                  )}
                </div>
              </form>
            </Card>
          )}
        </div>

        {/* ── Why + history ── */}
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <SectionLabel>Why we ask</SectionLabel>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-ink-soft">
              {[
                "NAICOM requires insurers to know who they cover.",
                "It stops anyone else buying cover in your name.",
                "Claims settle faster when your identity is already confirmed.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Icon name="check" className="mt-0.5 size-4 shrink-0 text-success" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>

          {attempts.length > 0 && (
            <Card className="p-6">
              <SectionLabel>Recent checks</SectionLabel>
              <ul className="mt-4 flex flex-col">
                {attempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{a.methodLabel}</p>
                      <p className="mt-0.5 font-mono text-[0.68rem] text-faint">{a.at}</p>
                    </div>
                    <Badge tone={a.outcome === "verified" ? "success" : a.outcome === "review" ? "warning" : "danger"} mono>
                      {a.outcome}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-faint">{label}</dt>
      <dd className={cx("mt-1 text-sm text-ink", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-faint">{children}</p>;
}
