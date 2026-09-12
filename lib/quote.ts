/**
 * Pure quote maths shared by the client-side quote summary and the server-side
 * binding engine. No DB, no "server-only" — safe to import anywhere.
 */

/** Statutory charges applied on top of the premium (Nigerian market defaults). */
export const STAMP_DUTY_RATE = 0.005; // 0.5% of premium
export const INSURANCE_VAT_RATE = 0.075; // 7.5% of premium

/** Cover terms a customer can pick at quote time. */
export const TERM_OPTIONS = [6, 12, 24] as const;
export type TermMonths = (typeof TERM_OPTIONS)[number];

/** A policy ending within this many days shows as "renew". */
export const RENEWAL_WINDOW_DAYS = 14;

export type QuotePricing = {
  basePremium: number;
  stampDuty: number;
  vat: number;
  total: number;
};

/**
 * Price a quote. Plan premiums are quoted per 12 months; the base premium is
 * pro-rated to the chosen term, then stamp duty and VAT are added.
 */
export function priceQuote(annualPremium: number, termMonths: number): QuotePricing {
  const basePremium = Math.round((annualPremium * termMonths) / 12);
  const stampDuty = Math.round(basePremium * STAMP_DUTY_RATE);
  const vat = Math.round(basePremium * INSURANCE_VAT_RATE);
  return { basePremium, stampDuty, vat, total: basePremium + stampDuty + vat };
}

/** Period end: start + term, minus one day (inclusive cover dates). */
export function periodEndFor(start: Date, termMonths: number): Date {
  const end = new Date(start);
  end.setMonth(end.getMonth() + termMonths);
  end.setDate(end.getDate() - 1);
  return end;
}
