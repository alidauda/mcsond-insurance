"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

/* ──────────────────────────────────────────────────────────────
   Controlled, client-side selectors. Use inside a 'use client'
   page that filters mock arrays with useState.
   ────────────────────────────────────────────────────────────── */

export type TabItem = { key: string; label: string; count?: number };

/** Underlined tabs (e.g. Policies: All / Active / Renewing / Refunded). */
export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-6 border-b border-line", className)}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cx(
              "-mb-px border-b-2 pb-3 text-sm font-medium transition-colors",
              active ? "border-navy text-navy" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {it.label}
            {typeof it.count === "number" && (
              <span className={cx("ml-1.5", active ? "text-navy/60" : "text-faint")}>({it.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pill filter chips (e.g. insurance categories, account status filters). */
export function FilterChips({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2.5", className)}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cx(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-navy bg-navy text-surface"
                : "border-navy/25 bg-surface text-navy hover:bg-navy/5",
            )}
          >
            {it.label}
            {typeof it.count === "number" && <span className="ml-1.5 opacity-70">({it.count})</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented toggle (e.g. Daily / Weekly / Monthly). */
export function Segmented({
  options,
  value,
  onChange,
  className,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cx("inline-flex items-center gap-1 rounded-[10px] border border-line bg-surface p-1", className)}>
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cx(
              "rounded-[7px] px-3.5 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-navy text-surface" : "text-muted hover:text-ink",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Quantity stepper. */
export function Stepper({
  value,
  onChange,
  min = 1,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="grid size-11 place-items-center rounded-[10px] border border-line bg-surface text-lg text-ink hover:bg-canvas"
        aria-label="Decrease"
      >
        –
      </button>
      <input
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
        inputMode="numeric"
        className="h-11 w-20 rounded-[10px] border border-line bg-surface text-center text-base tnum outline-none focus:border-navy"
      />
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="grid size-11 place-items-center rounded-[10px] border border-line bg-surface text-lg text-ink hover:bg-canvas"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

/** Generic local-state wrapper so a server page can host a small interactive island. */
export function Stateful<T>({
  initial,
  children,
}: {
  initial: T;
  children: (state: T, set: (v: T) => void) => ReactNode;
}) {
  const [state, set] = useState<T>(initial);
  return <>{children(state, set)}</>;
}
