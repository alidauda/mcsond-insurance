import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { setting } from "./schema";

/**
 * SwiftCheck (SwiftLink Verification Gateway) client — NIN identity checks.
 *
 * Source of truth: the OpenAPI spec at
 * https://swiftcheck-dev.swiftlink.ng/api-docs (nin-service).
 *
 * Auth is a pair of headers on every call — `client-id` and `client-secret`.
 * A wrong header NAME yields "Missing credentials"; wrong VALUES yield
 * "Invalid credentials" (both HTTP 401). Every response is wrapped in the same
 * envelope: { status, code, message, data, traceId, timestamp }.
 *
 * Verification methods (all return the same identity payload):
 *   nin       POST /nin-auth/raw-nin/verify        — verify a known NIN
 *   phone     POST /nin-auth/phone-number/verify   — NIN behind a registered SIM
 *   shareCode POST /nin-auth/share-code/verify     — NIMC share code
 *   demography POST /nin-auth/demography/search    — name + DOB + gender lookup
 *
 * PII rule for this app: raw NINs and biometric images are NEVER persisted.
 * We keep a masked NIN plus SwiftCheck's requestId / consentId, which are what
 * an auditor actually needs.
 */

export const SWIFTCHECK_SETTING_KEY = "swiftcheck";
export const SWIFTCHECK_DEFAULT_BASE_URL = "https://swiftcheck-dev.swiftlink.ng";
const NIN_PATH = "/core-verification/api/v1/nin-auth";

export type SwiftCheckCredentials = {
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
};

export type SwiftCheckConfig = {
  baseUrl: string;
  clientId: string | null;
  clientSecret: string | null;
  source: "Admin settings" | "Environment" | "Not set";
};

async function storedCredentials(): Promise<SwiftCheckCredentials> {
  try {
    const rows = await db
      .select({ value: setting.value })
      .from(setting)
      .where(eq(setting.key, SWIFTCHECK_SETTING_KEY))
      .limit(1);
    return (rows[0]?.value as SwiftCheckCredentials | null) ?? {};
  } catch {
    return {}; // DB unreachable → fall back to env
  }
}

/** Resolve the active config (DB override → env). */
export async function resolveSwiftCheckConfig(): Promise<SwiftCheckConfig> {
  const stored = await storedCredentials();
  const clientId = stored.clientId?.trim() || process.env.SWIFTCHECK_CLIENT_ID || null;
  const clientSecret = stored.clientSecret?.trim() || process.env.SWIFTCHECK_CLIENT_SECRET || null;
  const baseUrl = (stored.baseUrl?.trim() || process.env.SWIFTCHECK_BASE_URL || SWIFTCHECK_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const source: SwiftCheckConfig["source"] = stored.clientSecret?.trim()
    ? "Admin settings"
    : process.env.SWIFTCHECK_CLIENT_SECRET
      ? "Environment"
      : "Not set";
  return { baseUrl, clientId, clientSecret, source };
}

export async function isSwiftCheckConfigured(): Promise<boolean> {
  const c = await resolveSwiftCheckConfig();
  return !!(c.clientId && c.clientSecret);
}

/* ───────────────────────── errors ───────────────────────── */

/** SwiftCheck answered with an error envelope (bad credentials, no match, …). */
export class SwiftCheckApiError extends Error {
  constructor(
    public httpStatus: number,
    public code: string,
    message: string,
    public traceId?: string,
  ) {
    super(message);
  }
  /** Credentials rejected — an operator has to fix the settings. */
  get isAuthError(): boolean {
    return this.httpStatus === 401;
  }
  /** The account exists but isn't entitled to this method (HTTP 403). */
  get isNotEntitled(): boolean {
    return this.httpStatus === 403;
  }
  /** SwiftCheck's own upstream (NIMC) was unreachable — worth retrying. */
  get isUpstreamHiccup(): boolean {
    return this.httpStatus === 400 && /trouble reaching our verification provider/i.test(this.message);
  }
}

/** We never got a usable answer (network, timeout, non-JSON body). */
export class SwiftCheckNetworkError extends Error {}

/** Customer-facing copy; never leaks trace ids or provider internals. */
export function describeSwiftCheckError(err: unknown): string {
  if (err instanceof SwiftCheckApiError) {
    if (err.isAuthError) {
      return "Identity checks are temporarily unavailable. Our team has been notified.";
    }
    if (err.isNotEntitled) {
      return "That verification method isn't enabled on our account yet — please use another option.";
    }
    if (err.isUpstreamHiccup) {
      return "The national identity database is not responding right now. Try again in a moment.";
    }
    if (/not found|no record|no match/i.test(err.message)) {
      return "We couldn't find a record matching those details. Check them and try again.";
    }
    return err.message || "The identity check could not be completed.";
  }
  if (err instanceof SwiftCheckNetworkError) {
    return "We couldn't reach the identity service. Try again in a moment.";
  }
  return "Something went wrong running the identity check.";
}

/* ───────────────────────── transport ───────────────────────── */

const TIMEOUT_MS = 30_000;

type Envelope<T> = {
  status?: string;
  code?: string;
  message?: string;
  data?: T;
  traceId?: string;
  timestamp?: string;
};

/** How the customer proved their identity. */
export type KycMethod = "nin" | "phone" | "shareCode" | "demography";

export const KYC_METHOD_LABEL: Record<KycMethod, string> = {
  nin: "NIN",
  phone: "Phone number",
  shareCode: "NIMC share code",
  demography: "Name & date of birth",
};

/* ───────────────────────── entitlement ───────────────────────── */

/**
 * Which verification methods this account may actually call.
 *
 * SwiftCheck answers 403 "Insufficient permissions" for methods the business
 * isn't licensed for (raw NIN is commonly off by default). There is no
 * capability endpoint, so entitlement is learned from live failures: a method
 * starts enabled and is switched off for the process the first time it 403s.
 * Marking happens inside the transport, so every caller learns from one probe.
 */
const disabledMethods = new Set<KycMethod>();

/** Path suffix → method, for attributing a 403 to the right capability. */
const METHOD_BY_PATH: Record<string, KycMethod> = {
  "raw-nin/verify": "nin",
  "phone-number/verify": "phone",
  "share-code/verify": "shareCode",
  "demography/search": "demography",
};

function markUnavailableForPath(path: string) {
  for (const [suffix, method] of Object.entries(METHOD_BY_PATH)) {
    if (path.endsWith(suffix)) {
      disabledMethods.add(method);
      return;
    }
  }
}

export function markMethodUnavailable(method: KycMethod) {
  disabledMethods.add(method);
}

export function isMethodAvailable(method: KycMethod): boolean {
  return !disabledMethods.has(method);
}

export function availableMethods(): KycMethod[] {
  return (["nin", "phone", "shareCode", "demography"] as KycMethod[]).filter(isMethodAvailable);
}

const TRANSIENT_ATTEMPTS = 3;

/**
 * One request. Lookups are read-only, so a transient upstream failure or a
 * network blip is retried; validation, auth and entitlement errors are not.
 */
async function call<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const cfg = await resolveSwiftCheckConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new SwiftCheckApiError(401, "no-credentials", "SwiftCheck credentials are not configured.");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= TRANSIENT_ATTEMPTS; attempt++) {
    try {
      return await once<T>(cfg, path, init);
    } catch (err) {
      const retryable =
        err instanceof SwiftCheckNetworkError ||
        (err instanceof SwiftCheckApiError && err.isUpstreamHiccup);
      if (!retryable || attempt === TRANSIENT_ATTEMPTS) throw err;
      lastError = err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastError;
}

async function once<T>(
  cfg: SwiftCheckConfig,
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "client-id": cfg.clientId!,
        "client-secret": cfg.clientSecret!,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new SwiftCheckNetworkError(
      `Could not reach SwiftCheck: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = await res.text();
  let json: Envelope<T>;
  try {
    json = JSON.parse(text) as Envelope<T>;
  } catch {
    throw new SwiftCheckNetworkError("SwiftCheck returned an unreadable response.");
  }

  // The gateway signals failure via HTTP status AND an envelope status of "error".
  if (!res.ok || json.status === "error") {
    // 403 = this business isn't licensed for the method; stop offering it.
    if (res.status === 403) markUnavailableForPath(path);
    throw new SwiftCheckApiError(
      res.status,
      String(json.code ?? res.status),
      json.message ?? `SwiftCheck request failed (HTTP ${res.status})`,
      json.traceId,
    );
  }
  if (json.data === undefined) {
    throw new SwiftCheckApiError(res.status, String(json.code ?? "no-data"), json.message ?? "SwiftCheck returned no data.");
  }
  return json.data;
}

/* ───────────────────────── reference data ───────────────────────── */

export type SwiftCheckOption = { key: string; label: string };

const REF_TTL_MS = 60 * 60 * 1000;
const refCache = new Map<string, { at: number; value: unknown }>();

async function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = refCache.get(key);
  if (hit && Date.now() - hit.at < REF_TTL_MS) return hit.value as T;
  const value = await load();
  refCache.set(key, { at: Date.now(), value });
  return value;
}

/** Reasons SwiftCheck accepts for a lookup (NDPA requires a stated purpose). */
export async function getRequestReasons(): Promise<SwiftCheckOption[]> {
  return memo("requestReasons", async () => {
    const rows = await call<{ key: string; label: string }[]>(`${NIN_PATH}/request-reasons`);
    return (rows ?? []).map((r) => ({ key: String(r.key), label: String(r.label) }));
  });
}

/** PII fields this business is entitled to receive. The live payload carries
 * only { label, value } — `key` is absent despite the published schema. */
export async function getPiiFields(): Promise<{ label: string; value: string }[]> {
  return memo("piiFields", async () => {
    const rows = await call<{ label?: string; value?: string }[]>(`${NIN_PATH}/pii-fields`);
    return (rows ?? []).map((r) => ({ label: String(r.label ?? r.value ?? ""), value: String(r.value ?? "") }));
  });
}

/* ───────────────────────── verification ───────────────────────── */

/** The reason sent to SwiftCheck. NDPA requires a stated purpose; ours is
 * insurance onboarding, which is one of the gateway's own reason codes. */
export const DEFAULT_REQUEST_REASON = "insurance";

type IdentityPayload = {
  biographicData?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string; // DD-MM-YYYY
    gender?: string;
    birthState?: string;
    birthLga?: string;
    birthCountry?: string;
    residenceAddressLine1?: string;
  };
  contactData?: { phone1?: string; phone2?: string; email?: string };
  biometricData?: { biometricSubType?: string; biometricType?: string; image?: string }[];
  requestId?: string;
  NIN?: string;
  consentId?: string;
  pseudoId?: string;
};

/** Normalised identity record. `nin` is the RAW value — mask before storing. */
export type VerifiedIdentity = {
  nin: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null; // DD-MM-YYYY as returned
  gender: string | null;
  birthState: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** True when SwiftCheck returned a face photo. */
  hasPhoto: boolean;
  /** Base64 JPEG of the NIMC face photo. Biometric PII — store only behind an
   * access check, never log it, never expose it to the customer. */
  photoBase64: string | null;
  requestId: string | null;
  consentId: string | null;
  pseudoId: string | null;
};

function normalise(data: IdentityPayload): VerifiedIdentity {
  const b = data.biographicData ?? {};
  const face = (data.biometricData ?? []).find((x) => x.biometricSubType === "face" && !!x.image);
  const first = (b.firstName ?? "").trim();
  const middle = (b.middleName ?? "").trim();
  const last = (b.lastName ?? "").trim();
  return {
    nin: data.NIN ? String(data.NIN).trim() : null,
    firstName: first,
    middleName: middle || null,
    lastName: last,
    fullName: [first, middle, last].filter(Boolean).join(" "),
    dateOfBirth: b.dateOfBirth?.trim() || null,
    gender: b.gender?.trim() || null,
    birthState: b.birthState?.trim() || null,
    address: b.residenceAddressLine1?.trim() || null,
    phone: data.contactData?.phone1?.trim() || null,
    email: data.contactData?.email?.trim() || null,
    hasPhoto: face !== undefined,
    photoBase64: face?.image ?? null,
    requestId: data.requestId ?? null,
    consentId: data.consentId ?? null,
    pseudoId: data.pseudoId ?? null,
  };
}

/** Verify a NIN directly. */
export async function verifyByNin(nin: string, requestReason = DEFAULT_REQUEST_REASON): Promise<VerifiedIdentity> {
  const data = await call<IdentityPayload>(`${NIN_PATH}/raw-nin/verify`, {
    method: "POST",
    body: { nin, requestReason },
  });
  return normalise(data);
}

/** Verify via the NIN attached to a registered phone number. */
export async function verifyByPhone(phone: string, requestReason = DEFAULT_REQUEST_REASON): Promise<VerifiedIdentity> {
  const data = await call<IdentityPayload>(`${NIN_PATH}/phone-number/verify`, {
    method: "POST",
    body: { phone, requestReason },
  });
  return normalise(data);
}

/** Verify with a NIMC share code (the customer generates it in the NIMC app). */
export async function verifyByShareCode(shareCode: string, requestReason = DEFAULT_REQUEST_REASON): Promise<VerifiedIdentity> {
  const data = await call<IdentityPayload>(`${NIN_PATH}/share-code/verify`, {
    method: "POST",
    body: { shareCode, requestReason },
  });
  return normalise(data);
}

/** Look an identity up by name, date of birth and gender. */
export async function searchByDemography(
  input: { firstName: string; lastName: string; dateOfBirth: string; gender: "m" | "f" },
  requestReason = DEFAULT_REQUEST_REASON,
): Promise<VerifiedIdentity> {
  const data = await call<IdentityPayload>(`${NIN_PATH}/demography/search`, {
    method: "POST",
    body: { ...input, requestReason },
  });
  return normalise(data);
}

/* ───────────────────────── PII helpers ───────────────────────── */

/** "12345678901" → "*******8901". Only the masked form is ever persisted. */
export function maskNin(nin: string | null): string | null {
  if (!nin) return null;
  const digits = nin.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/** Strip anything we must not store from a request body before logging it. */
export function redactRequest(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  if (typeof out.nin === "string") out.nin = maskNin(out.nin);
  if (typeof out.shareCode === "string") out.shareCode = "***";
  if (typeof out.phone === "string") out.phone = `${String(out.phone).slice(0, 4)}*******`;
  return out;
}

/** Response summary safe to store: no NIN, no biometrics, no full address. */
export function redactIdentity(identity: VerifiedIdentity): Record<string, unknown> {
  return {
    ninMasked: maskNin(identity.nin),
    fullName: identity.fullName,
    dateOfBirth: identity.dateOfBirth,
    gender: identity.gender,
    birthState: identity.birthState,
    phone: identity.phone ? `${identity.phone.slice(0, 4)}*******` : null,
    hasPhoto: identity.hasPhoto,
    requestId: identity.requestId,
    consentId: identity.consentId,
    pseudoId: identity.pseudoId,
  };
}
