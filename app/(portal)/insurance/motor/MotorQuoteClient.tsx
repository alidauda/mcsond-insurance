"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { PageHeading, Card, SectionLabel, Button, Badge, Money, Divider, cx } from "@/components/ui";
import { naira } from "@/lib/format";
import { priceQuote, periodEndFor } from "@/lib/quote";
import type { NemOption, NemVehicleType, NemEnhancedType } from "@/lib/nem";
import type { NemProductCode } from "@/lib/mock-data";
import { KycGate } from "@/components/KycGate";
import type { KycStatus } from "@/lib/mock-data";
import type { VerifiedPolicyholder } from "@/lib/kyc";
import { bindMotorPolicyAction, loadVehicleModels, quotePremium, type MotorBindState } from "./actions";

const inputCls =
  "h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-navy disabled:opacity-60";

const TITLES = ["Mr", "Mrs", "Miss", "Ms", "Dr", "Chief", "Alhaji", "Alhaja"];
const ID_TYPES = ["International Passport", "Driver's Licence", "National ID (NIN)", "Voter's Card"];

const PRODUCT_LABEL: Record<NemProductCode, string> = {
  mtp: "Third-Party Motor",
  emtp: "Enhanced Third-Party",
  comp: "Comprehensive Motor",
};

function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function longDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MotorQuoteClient({
  plan,
  vehicleTypes,
  makes,
  branches,
  enhancedTypes,
  defaults,
  walletBalance,
  kycStatus,
  verified,
}: {
  plan: { id: string; name: string; underwriter: string; product: NemProductCode; features: string[] };
  vehicleTypes: NemVehicleType[];
  makes: NemOption[];
  branches: NemOption[];
  enhancedTypes: NemEnhancedType[];
  defaults: { firstName: string; lastName: string; email: string; dob: string; sex: string; phone: string; state: string };
  walletBalance: number;
  kycStatus: KycStatus;
  /** Set when the account is KYC-verified: identity comes from the national record, not the form. */
  verified: VerifiedPolicyholder | null;
}) {
  const [state, formAction, pending] = useActionState<MotorBindState, FormData>(bindMotorPolicyAction, null);

  // vehicle
  const [makeCode, setMakeCode] = useState("");
  const [models, setModels] = useState<NemOption[]>([]);
  const [modelCode, setModelCode] = useState("");
  const [loadingModels, startLoadModels] = useTransition();
  const [typeId, setTypeId] = useState<number>(vehicleTypes[0]?.id ?? 1);
  const [usage, setUsage] = useState<"Private" | "Commercial">("Private");
  // cover
  const [startDate, setStartDate] = useState(isoToday);
  const [variant, setVariant] = useState(enhancedTypes[0]?.name ?? "Type A");
  const [vehicleValue, setVehicleValue] = useState("");
  const [excessBuyBack, setExcessBuyBack] = useState(false);
  // live comprehensive quote from NEM, keyed by the inputs it was fetched for
  const [compQuote, setCompQuote] = useState<{ key: string; premium: number | null; note: string | null } | null>(null);
  const [quoting, startQuote] = useTransition();

  const type = vehicleTypes.find((t) => t.id === typeId) ?? vehicleTypes[0];
  const valueNum = Number(vehicleValue.replace(/[^\d]/g, "")) || 0;
  const compKey = `${valueNum}|${typeId}|${usage}|${excessBuyBack ? 1 : 0}`;

  // Models cascade off the make (fetched on change, not in an effect).
  function chooseMake(code: string) {
    setMakeCode(code);
    setModels([]);
    setModelCode("");
    if (!code) return;
    startLoadModels(async () => {
      const list = await loadVehicleModels(code);
      setModels(list);
    });
  }

  // Comprehensive premium is quoted live by NEM (debounced); stale answers are ignored via compKey.
  useEffect(() => {
    if (plan.product !== "comp" || valueNum < 100_000) return;
    const key = compKey;
    const handle = setTimeout(() => {
      startQuote(async () => {
        const r = await quotePremium({ plan: plan.id, vehicleTypeId: typeId, usage, vehicleValue: valueNum, excessBuyBack });
        setCompQuote(r.ok ? { key, premium: r.premium, note: null } : { key, premium: null, note: r.message });
      });
    }, 450);
    return () => clearTimeout(handle);
  }, [plan.product, plan.id, compKey, typeId, usage, valueNum, excessBuyBack]);

  // Third-party & enhanced premiums come straight from NEM's reference data.
  const premium = useMemo<number | null>(() => {
    if (plan.product === "mtp") return type ? (usage === "Commercial" ? type.commercialPrice : type.privatePrice) : null;
    if (plan.product === "emtp") return enhancedTypes.find((e) => e.name === variant)?.premium ?? null;
    return compQuote && compQuote.key === compKey ? compQuote.premium : null;
  }, [plan.product, type, usage, enhancedTypes, variant, compQuote, compKey]);
  const premiumNote = plan.product === "comp" && compQuote && compQuote.key === compKey ? compQuote.note : null;

  const pricing = useMemo(() => (premium ? priceQuote(premium, 12) : null), [premium]);
  const shortfall = pricing ? Math.max(0, pricing.total - walletBalance) : 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = Number.isNaN(start.getTime()) ? null : periodEndFor(start, 12);
  const needsInspection = plan.product !== "mtp";
  const enhanced = enhancedTypes.find((e) => e.name === variant);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="plan" value={plan.id} />
      <input type="hidden" name="vehicleTypeName" value={type?.name ?? ""} />

      <PageHeading
        eyebrow={`Motor · ${PRODUCT_LABEL[plan.product]} · issued by ${plan.underwriter}`}
        title={
          <>
            Cover your <em className="italic text-crimson">vehicle.</em>
          </>
        }
        description="NEM prices this live and issues the certificate the moment you pay from your wallet."
        actions={
          <Button variant="outline" href="/insurance">
            ← All plans
          </Button>
        }
      />

      <KycGate status={kycStatus} />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* ── Policyholder ── */}
          <Card className="p-6">
            <SectionLabel className="mb-5">Policyholder</SectionLabel>

            {verified && (
              // Identity is settled by KYC — shown, not typed. The server takes
              // these from the national record regardless of what's posted.
              <div className="mb-5 rounded-[12px] border border-success/30 bg-success-bg p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-success">
                  <Icon name="shieldCheck" className="size-4" /> From your verified identity
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <Summary label="Policyholder" value={verified.fullName} />
                  <Summary label="Date of birth" value={verified.dob ?? "—"} />
                  <Summary label="Sex" value={verified.sex ? verified.sex[0].toUpperCase() + verified.sex.slice(1) : "—"} />
                  <Summary label="Phone" value={verified.phone ?? "—"} />
                </dl>
                <p className="mt-3 text-xs text-success/80">
                  These are passed to the underwriter exactly as they appear on your NIN. You only fill in what we don&rsquo;t hold.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Title" className="sm:col-span-1">
                <select name="title" defaultValue={verified?.sex === "female" ? "Mrs" : "Mr"} className={inputCls}>
                  {TITLES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              {!verified && (
                <>
                  <Field label="First name" className="sm:col-span-2">
                    <input name="firstName" defaultValue={defaults.firstName} required className={inputCls} />
                  </Field>
                  <Field label="Last name" className="sm:col-span-3">
                    <input name="lastName" defaultValue={defaults.lastName} required className={inputCls} />
                  </Field>
                  <Field label="Date of birth" className="sm:col-span-2">
                    <input type="date" name="dob" max={isoToday()} defaultValue={defaults.dob} required className={inputCls} />
                  </Field>
                  <Field label="Sex" className="sm:col-span-1">
                    <select name="sex" defaultValue={defaults.sex || "male"} className={inputCls}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </Field>
                </>
              )}
              <Field label="Phone" className={verified ? "sm:col-span-5" : "sm:col-span-3"}>
                <input type="tel" name="phone" placeholder="08034821190" defaultValue={verified?.phone ?? defaults.phone} required className={inputCls} />
              </Field>
              <Field label="Residential address" className="sm:col-span-6">
                <input name="address" placeholder="Plot / street, area, city" required className={inputCls} />
              </Field>
              <Field label="State of residence" className="sm:col-span-2">
                <input name="state" placeholder="Lagos" defaultValue={verified?.stateOfOrigin ?? defaults.state} required className={inputCls} />
              </Field>
              <Field label="Occupation" className="sm:col-span-2">
                <input name="occupation" placeholder="Procurement manager" required className={inputCls} />
              </Field>
              <Field label="Company (optional)" className="sm:col-span-2">
                <input name="companyName" placeholder="Insured company, if any" className={inputCls} />
              </Field>
              <Field label="ID type" className="sm:col-span-2">
                <select name="idType" defaultValue={verified ? "National ID (NIN)" : ID_TYPES[0]} className={inputCls}>
                  {ID_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="ID number" className="sm:col-span-2">
                <input name="idNo" placeholder="A00894222" required className={inputCls} />
              </Field>
              <Field label="TIN (optional)" className="sm:col-span-2">
                <input name="tin" placeholder="19000-100" className={inputCls} />
              </Field>
            </div>
            <p className="mt-4 text-xs text-faint">Certificate and documents go to {defaults.email}.</p>
          </Card>

          {/* ── Vehicle ── */}
          <Card className="p-6">
            <SectionLabel className="mb-5">Vehicle</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Make" className="sm:col-span-3">
                <select name="makeCode" value={makeCode} onChange={(e) => chooseMake(e.target.value)} required className={inputCls}>
                  <option value="">Select make…</option>
                  {makes.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={loadingModels ? "Model · loading…" : "Model"} className="sm:col-span-3">
                <select
                  name="modelCode"
                  value={modelCode}
                  onChange={(e) => setModelCode(e.target.value)}
                  disabled={!makeCode || loadingModels}
                  required
                  className={inputCls}
                >
                  <option value="">{makeCode ? "Select model…" : "Choose a make first"}</option>
                  {models.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vehicle type" className="sm:col-span-2">
                <select name="vehicleTypeId" value={typeId} onChange={(e) => setTypeId(Number(e.target.value))} className={inputCls}>
                  {vehicleTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Usage" className="sm:col-span-2">
                <select name="usage" value={usage} onChange={(e) => setUsage(e.target.value as "Private" | "Commercial")} className={inputCls}>
                  <option>Private</option>
                  <option>Commercial</option>
                </select>
              </Field>
              <Field label="Year" className="sm:col-span-1">
                <input name="year" inputMode="numeric" placeholder="2020" required className={cx(inputCls, "font-mono tnum")} />
              </Field>
              <Field label="Colour" className="sm:col-span-1">
                <input name="color" placeholder="Black" required className={inputCls} />
              </Field>
              <Field label="Registration no." className="sm:col-span-2">
                <input name="regNo" placeholder="LSR-394 GH" required className={cx(inputCls, "font-mono uppercase")} />
              </Field>
              <Field label="Engine no." className="sm:col-span-2">
                <input name="engineNo" required className={cx(inputCls, "font-mono uppercase")} />
              </Field>
              <Field label="Chassis / VIN" className="sm:col-span-2">
                <input name="chassisNo" required className={cx(inputCls, "font-mono uppercase")} />
              </Field>
            </div>
          </Card>

          {/* ── Cover ── */}
          <Card className="p-6">
            <SectionLabel className="mb-5">Cover</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Start date" className="sm:col-span-2">
                <input
                  type="date"
                  name="startDate"
                  value={startDate}
                  min={isoToday()}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
              <div className="flex items-end pb-2 text-sm text-muted sm:col-span-4">
                {end ? `12 months · ${longDate(start)} – ${longDate(end)}` : "12-month cover"}
              </div>

              {plan.product === "comp" && (
                <>
                  <Field label="Vehicle value (₦)" className="sm:col-span-3">
                    <input
                      name="vehicleValue"
                      inputMode="numeric"
                      value={vehicleValue}
                      onChange={(e) => setVehicleValue(e.target.value)}
                      placeholder="12,000,000"
                      required
                      className={cx(inputCls, "font-mono tnum")}
                    />
                  </Field>
                  <label className="flex items-end gap-2.5 pb-2.5 sm:col-span-3">
                    <input
                      type="checkbox"
                      name="excessBuyBack"
                      checked={excessBuyBack}
                      onChange={(e) => setExcessBuyBack(e.target.checked)}
                      className="size-4 accent-[var(--color-navy)]"
                    />
                    <span className="text-sm text-ink">
                      Excess buy-back
                      <span className="block text-xs text-muted">Removes your excess on a claim — NEM prices it into the premium.</span>
                    </span>
                  </label>
                </>
              )}

              {plan.product === "emtp" && (
                <div className="grid gap-3 sm:col-span-6 sm:grid-cols-2">
                  {enhancedTypes.map((e) => {
                    const on = e.name === variant;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setVariant(e.name)}
                        aria-pressed={on}
                        className={cx(
                          "rounded-[12px] border p-4 text-left transition-colors",
                          on ? "border-navy bg-navy/[0.04] ring-2 ring-navy" : "border-line hover:bg-canvas",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-serif text-lg font-semibold text-navy">{e.name}</p>
                          <Money value={e.premium} className="text-lg text-navy" />
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-muted">
                          <li>Third-party property damage · {naira(e.thirdPartyDamage)}</li>
                          <li>Bodily injury &amp; death · {e.injuryDeath}</li>
                          <li>Own damage (third-party involved) · {naira(e.ownDamage)}</li>
                          <li>Medical {naira(e.medicalExpenses)} · Legal {naira(e.legal)} · Towing {naira(e.towing)}</li>
                        </ul>
                      </button>
                    );
                  })}
                  <input type="hidden" name="variant" value={variant} />
                </div>
              )}
            </div>
          </Card>

          {/* ── Inspection ── */}
          {needsInspection && (
            <Card className="p-6">
              <SectionLabel className="mb-1">Vehicle inspection</SectionLabel>
              <p className="mb-5 text-sm text-muted">NEM inspects the vehicle before comprehensive or enhanced cover is confirmed.</p>
              <div className="grid gap-4 sm:grid-cols-6">
                <Field label="Inspection address" className="sm:col-span-6">
                  <input name="insAddress" placeholder="Where the vehicle can be inspected" required className={inputCls} />
                </Field>
                <Field label="NEM branch" className="sm:col-span-2">
                  <select name="insBranch" defaultValue={branches.find((b) => /lagos/i.test(b.name))?.code ?? branches[0]?.code ?? ""} className={inputCls}>
                    {branches.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Preferred date" className="sm:col-span-2">
                  <input type="date" name="insDate" defaultValue={isoToday(1)} min={isoToday()} required className={inputCls} />
                </Field>
                <Field label="Contact phone" className="sm:col-span-2">
                  <input type="tel" name="insContact" placeholder="08034821190" required className={inputCls} />
                </Field>
                <Field label="Person presenting the vehicle" className="sm:col-span-6">
                  <input name="insPerson" defaultValue={`${defaults.firstName} ${defaults.lastName}`.trim()} required className={inputCls} />
                </Field>
              </div>
            </Card>
          )}
        </div>

        {/* ── Quote summary (sticky) ── */}
        <div className="lg:sticky lg:top-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Live quote</SectionLabel>
              <Badge tone="info" dot mono>
                NEM
              </Badge>
            </div>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-navy">{plan.name}</h2>
            <p className="mt-1 text-sm text-muted">Issued by {plan.underwriter}</p>

            <ul className="mt-4 flex flex-col gap-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-ink-soft">
                  <Icon name="check" className="size-4 shrink-0 text-success" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-[12px] bg-surface-soft p-4">
              {pricing ? (
                <>
                  <Row label={`Premium · ${type?.name ?? "vehicle"}${plan.product === "emtp" ? ` · ${variant}` : ""}`} value={naira(pricing.basePremium)} />
                  <Row label="Stamp duty (0.5%)" value={naira(pricing.stampDuty)} />
                  <Row label="VAT (7.5%)" value={naira(pricing.vat)} />
                  <Divider className="my-3 border-line-soft" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">Total</span>
                    <Money value={pricing.total} className="text-lg text-navy" />
                  </div>
                  {enhanced && plan.product === "emtp" && (
                    <p className="mt-3 text-xs text-muted">Own-damage limit {naira(enhanced.ownDamage)} · third-party {naira(enhanced.thirdPartyDamage)}</p>
                  )}
                  {plan.product === "comp" && valueNum > 0 && (
                    <p className="mt-3 text-xs text-muted">Sum insured {naira(valueNum)}{excessBuyBack ? " · excess buy-back included" : ""}</p>
                  )}
                </>
              ) : (
                <p className="py-2 text-sm text-muted">
                  {quoting
                    ? "Fetching NEM's premium…"
                    : premiumNote ?? (plan.product === "comp" ? "Enter the vehicle value to get NEM's premium." : "Choose a vehicle type to see the premium.")}
                </p>
              )}
            </div>

            <div className="mt-4 space-y-2 rounded-[12px] border border-line p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Wallet balance</span>
                <span className="font-mono tnum text-ink">{naira(walletBalance)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Shortfall</span>
                <span className={cx("font-mono tnum font-medium", shortfall > 0 ? "text-crimson" : "text-success")}>
                  {shortfall > 0 ? naira(-shortfall) : "—"}
                </span>
              </div>
            </div>

            {state && !state.ok && <p className="mt-4 text-sm font-medium text-crimson">{state.message}</p>}

            {shortfall > 0 ? (
              <Button href="/wallet" variant="primary" className="mt-5 w-full">
                Top up {naira(shortfall)} to continue
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                className="mt-5 w-full"
                disabled={pending || !pricing || quoting || kycStatus !== "verified"}
              >
                {kycStatus !== "verified"
                  ? "Verify your identity first"
                  : pending
                    ? "Issuing with NEM…"
                    : pricing
                      ? `Bind & pay ${naira(pricing.total)}`
                      : "Complete the quote"}
              </Button>
            )}
            <p className="mt-3 text-center text-xs text-faint">
              Paid from your wallet · if NEM declines, the premium is refunded instantly
            </p>
          </Card>
        </div>
      </div>
    </form>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-success/70">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-mono tnum text-ink">{value}</span>
    </div>
  );
}
