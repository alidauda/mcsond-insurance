"use client";

import { useActionState } from "react";
import { Card, SectionLabel, SectionTitle, Button, Badge, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { AdminInsurancePlan } from "@/lib/mock-data";
import { updateInsurancePlan, createInsurancePlan, type PlanResult } from "./actions";

const CATEGORIES = ["Motor", "Property", "Goods", "Health"] as const;
const PRODUCTS: { value: string; label: string }[] = [
  { value: "mtp", label: "Third-Party Motor (buyMtp)" },
  { value: "emtp", label: "Enhanced Third-Party (buyEmtp)" },
  { value: "comp", label: "Comprehensive Motor (buyComp)" },
];

/** Which underwriter product this plan maps to. Every plan needs one. */
function ProviderFields({ productCode }: { productCode?: string | null }) {
  return (
    <>
      <label className="block">
        <FieldLabel>Underwriter</FieldLabel>
        <input value="NEM eInsurance API" readOnly className={cx(inputCls, "bg-surface-soft text-muted")} />
      </label>
      <label className="block">
        <FieldLabel>Underwriter product</FieldLabel>
        <select name="productCode" defaultValue={productCode ?? ""} required className={inputCls}>
          <option value="">Choose a product…</option>
          {PRODUCTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <SectionLabel className="mb-1.5">{children}</SectionLabel>;
}

const inputCls =
  "h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-navy";
const numCls = cx(inputCls, "font-mono tnum");

function ResultNote({ state }: { state: PlanResult }) {
  if (!state) return null;
  return (
    <p className={cx("text-sm font-medium", state.ok ? "text-success" : "text-crimson")}>{state.message}</p>
  );
}

/** One editable catalogue row. */
function PlanRow({ plan }: { plan: AdminInsurancePlan }) {
  const [state, formAction, pending] = useActionState<PlanResult, FormData>(updateInsurancePlan, null);

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="reference" value={plan.id} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-grid size-10 place-items-center rounded-[10px] bg-navy/5 text-navy">
              <Icon name="shield" className="size-5" />
            </span>
            <p className="font-serif text-lg font-semibold text-navy">{plan.name}</p>
            <Badge tone={plan.active ? "success" : "neutral"}>{plan.active ? "Live" : "Hidden"}</Badge>
            {plan.provider === "nem" && (
              <Badge tone="info" dot={false} mono>
                NEM · {plan.productCode?.toUpperCase()}
              </Badge>
            )}
            {plan.popular && (
              <Badge tone="danger" dot>
                Popular
              </Badge>
            )}
          </div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
            {plan.category} · {plan.id}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="block lg:col-span-2">
            <FieldLabel>Plan name</FieldLabel>
            <input name="name" defaultValue={plan.name} className={inputCls} />
          </label>
          <label className="block lg:col-span-2">
            <FieldLabel>Underwriter</FieldLabel>
            <input name="underwriter" defaultValue={plan.underwriter} className={inputCls} />
          </label>
          <label className="block">
            <FieldLabel>From price (₦, display only)</FieldLabel>
            <input name="premium" defaultValue={plan.premium} inputMode="numeric" className={numCls} />
          </label>
          <label className="block">
            <FieldLabel>Class</FieldLabel>
            <select name="category" defaultValue={plan.category} className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2 lg:col-span-4">
            <FieldLabel>Features (comma-separated)</FieldLabel>
            <input name="features" defaultValue={plan.features.join(", ")} className={inputCls} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2 lg:col-span-6">
            <ProviderFields productCode={plan.productCode} />
          </div>
          <div className="flex items-end gap-3 pb-0.5 sm:col-span-2">
            <label className="flex h-11 flex-1 cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink">
              <input type="checkbox" name="popular" defaultChecked={!!plan.popular} className="size-4 accent-[var(--color-crimson)]" />
              Popular
            </label>
            <label className="flex h-11 flex-1 cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3.5 text-sm text-ink">
              <input type="checkbox" name="active" defaultChecked={plan.active} className="size-4 accent-[var(--color-navy)]" />
              Live
            </label>
            <Button type="submit" variant="secondary" disabled={pending} className="px-4 py-2.5">
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <ResultNote state={state} />
      </form>
    </Card>
  );
}

/** New-plan form. */
function AddPlanForm() {
  const [state, formAction, pending] = useActionState<PlanResult, FormData>(createInsurancePlan, null);

  return (
    <Card className="p-5">
      <SectionTitle className="text-xl">Add a plan</SectionTitle>
      <form action={formAction} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="block lg:col-span-2">
            <FieldLabel>Plan name</FieldLabel>
            <input name="name" placeholder="Marine Cargo" className={inputCls} />
          </label>
          <label className="block lg:col-span-2">
            <FieldLabel>Underwriter</FieldLabel>
            <input name="underwriter" placeholder="Leadway Assurance" className={inputCls} />
          </label>
          <label className="block">
            <FieldLabel>Annual premium (₦)</FieldLabel>
            <input name="premium" inputMode="numeric" placeholder="120000" className={numCls} />
          </label>
          <label className="block">
            <FieldLabel>Class</FieldLabel>
            <select name="category" defaultValue="Goods" className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2 lg:col-span-6">
            <FieldLabel>Features (comma-separated)</FieldLabel>
            <input name="features" placeholder="All risks, Port to door, War & strikes" className={inputCls} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2 lg:col-span-6">
            <ProviderFields />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" icon="plus" disabled={pending}>
            {pending ? "Adding…" : "Add plan"}
          </Button>
          <ResultNote state={state} />
        </div>
      </form>
    </Card>
  );
}

export default function InsurancePlansClient({ plans }: { plans: AdminInsurancePlan[] }) {
  return (
    <div className="flex flex-col gap-4">
      {plans.map((p) => (
        <PlanRow key={p.id} plan={p} />
      ))}
      <AddPlanForm />
    </div>
  );
}
