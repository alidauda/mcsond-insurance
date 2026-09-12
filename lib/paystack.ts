import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { setting } from "./schema";

/**
 * Thin Paystack REST client (https://paystack.com/docs). No SDK — the official
 * npm package is years stale; the REST surface we need is three calls.
 *
 * Flow (redirect method):
 *  1. POST /transaction/initialize (server, secret key, amount in KOBO)
 *  2. Redirect the customer to `authorization_url`
 *  3. Paystack redirects back to callback_url?reference=… → verify + credit
 *  4. Webhook `charge.success` (source of truth if the browser never returns)
 *
 * Test mode: use a sk_test_ key; small amounts (≥ ₦100) are fine with the
 * standard test cards (e.g. 4084 0840 8408 4081, any future expiry, CVV 408).
 *
 * Key source: the secret key comes from the `setting` row (key = "paystack",
 * editable in Admin → Settings) when present, otherwise PAYSTACK_SECRET_KEY.
 * The DB value always wins so ops can rotate keys without a redeploy.
 */

const PAYSTACK_BASE = "https://api.paystack.co";

/** Persisted Paystack config (setting.value under key "paystack"). */
export const PAYSTACK_SETTING_KEY = "paystack";
export type PaystackKeys = { publicKey?: string; secretKey?: string };

/** Read the stored Paystack keys; empty object if unset or the DB is down. */
async function storedKeys(): Promise<PaystackKeys> {
  try {
    const rows = await db
      .select({ value: setting.value })
      .from(setting)
      .where(eq(setting.key, PAYSTACK_SETTING_KEY))
      .limit(1);
    return (rows[0]?.value as PaystackKeys | null) ?? {};
  } catch {
    return {}; // DB unreachable → fall back to env
  }
}

/** Resolve the secret key (DB override → env), or null when neither is set. */
async function loadSecretKey(): Promise<string | null> {
  const stored = (await storedKeys()).secretKey?.trim();
  return stored || process.env.PAYSTACK_SECRET_KEY || null;
}

async function secretKey(): Promise<string> {
  const key = await loadSecretKey();
  if (!key) {
    throw new Error(
      "Paystack secret key is not configured — set it in Admin → Settings or PAYSTACK_SECRET_KEY.",
    );
  }
  return key;
}

/** True when a secret key is available from either source. */
export async function isPaystackConfigured(): Promise<boolean> {
  return (await loadSecretKey()) !== null;
}

type PaystackEnvelope<T> = { status: boolean; message: string; data: T };

/** Thrown when we never reached Paystack (vs. Paystack rejecting the request).
 * Endpoint security on dev machines can intermittently drop Node's outbound
 * TLS, so network-level failures are retried with short per-attempt timeouts. */
export class PaystackNetworkError extends Error {}

/**
 * Paystack transaction statuses that mean the payment is genuinely dead.
 * Everything else ("ongoing", "pending", "queued", …) is still in flight —
 * bank transfer and USSD sit there for minutes — and must not be written off.
 */
export const TERMINAL_FAILURE_STATUSES = new Set(["failed", "abandoned", "reversed"]);

const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 6_000;

/**
 * `retry` must stay false for calls that are not safe to repeat. Initializing a
 * transaction is one: a request that reached Paystack but timed out on the way
 * back has already created the checkout, and sending it again earns a
 * "Duplicate Transaction Reference" rejection that surfaces as a misleading
 * configuration error. Reads (verify) are safe to retry.
 */
async function paystackFetch<T>(
  path: string,
  init?: RequestInit,
  opts?: { retry?: boolean },
): Promise<T> {
  const key = await secretKey();
  const attempts = opts?.retry === false ? 1 : ATTEMPTS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${PAYSTACK_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
    } catch (err) {
      lastError = err; // network-level failure — retry
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    // Reached Paystack: HTTP-level outcomes are authoritative, never retried
    // (initialize/charge calls must not be replayed blindly).
    const json = (await res.json().catch(() => null)) as PaystackEnvelope<T> | null;
    if (!res.ok || !json?.status) {
      throw new Error(`Paystack ${path} failed: ${json?.message ?? `HTTP ${res.status}`}`);
    }
    return json.data;
  }
  throw new PaystackNetworkError(
    `Could not reach Paystack after ${attempts} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

export type InitializedTransaction = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

/** Server-side initialize. `amountNaira` is integer Naira; Paystack takes kobo. */
export async function initializeTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializedTransaction> {
  const data = await paystackFetch<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
        amount: params.amountNaira * 100,
        currency: "NGN",
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
      }),
    },
    // Creating a checkout is not idempotent — never replay it.
    { retry: false },
  );
  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}

export type VerifiedTransaction = {
  status: string; // success | failed | abandoned | …
  reference: string;
  amountKobo: number;
  currency: string;
  channel: string | null;
  gatewayResponse: string | null;
  paidAt: string | null;
};

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const d = await paystackFetch<{
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel?: string;
    gateway_response?: string;
    paid_at?: string;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    status: d.status,
    reference: d.reference,
    amountKobo: d.amount,
    currency: d.currency,
    channel: d.channel ?? null,
    gatewayResponse: d.gateway_response ?? null,
    paidAt: d.paid_at ?? null,
  };
}

/**
 * Webhook authenticity: `x-paystack-signature` is an HMAC-SHA512 of the RAW
 * request body signed with the secret key. Compare in constant time.
 */
export async function isValidWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const key = await loadSecretKey();
  if (!key) return false;
  const digest = createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
