"use client";

import { useState } from "react";

export interface FilterChip {
  /** stable key, e.g. "all" | "active" | "suspended" */
  value: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  chips: FilterChip[];
  defaultValue?: string;
  /** controlled value (optional) */
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

/**
 * Selectable filter tabs. Works uncontrolled (local state) for the mock phase;
 * pass `value`/`onChange` to drive it from URL search params once wired to
 * `listUsers`.
 */
export function FilterChips({ chips, defaultValue, value, onChange, className }: FilterChipsProps) {
  const [internal, setInternal] = useState(defaultValue ?? chips[0]?.value);
  const active = value ?? internal;

  function select(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {chips.map((chip) => {
        const isActive = chip.value === active;
        return (
          <button
            key={chip.value}
            type="button"
            onClick={() => select(chip.value)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-navy bg-navy text-surface"
                : "border-line bg-surface text-ink-soft hover:border-navy/40"
            }`}
          >
            {chip.label}
            {chip.count !== undefined && (
              <span className={`tnum text-xs ${isActive ? "text-surface/70" : "text-faint"}`}>
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
