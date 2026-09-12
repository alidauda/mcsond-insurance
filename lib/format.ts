/** Naira formatting helpers (the portal is NGN-native). */

const NAIRA = "₦"; // ₦

/** 320500 -> "₦320,500" */
export function naira(value: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const body = abs.toLocaleString("en-NG");
  const prefix = opts.sign ? (value < 0 ? "-" : "+") : value < 0 ? "-" : "";
  return `${prefix}${NAIRA}${body}`;
}

/** 142800000 -> "₦142.8M" (compact, for KPI tiles) */
export function nairaCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${NAIRA}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${NAIRA}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${NAIRA}${Math.round(abs / 1e3)}k`;
  return `${sign}${NAIRA}${abs}`;
}

/** Bare grouped number, no symbol. 8500000 -> "8,500,000" */
export function grouped(value: number): string {
  return value.toLocaleString("en-NG");
}

export const SYMBOL = NAIRA;
