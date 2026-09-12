import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { integration, setting } from "./schema";
import { PAYSTACK_SETTING_KEY, type PaystackKeys } from "./paystack";
import { resolveNemConfig } from "./nem";
import { resolveSwiftCheckConfig } from "./swiftcheck";
import { systemProfile as mockSystemProfile, reports as mockReports, type Status } from "./mock-data";

/* ───────────────────────── 16 · System profile ───────────────────────── */

type SystemProfile = typeof mockSystemProfile;
type Brokerage = SystemProfile["brokerage"];
type Integration = SystemProfile["integrations"][number];
type Defaults = SystemProfile["defaults"];

/** Coerce a stored integration status string into the Status union. */
function integrationStatus(v: unknown): Status {
  return v === "live" || v === "attention" ? v : "attention";
}

/**
 * Brokerage profile, integrations and finance defaults for /admin/settings.
 * Brokerage + defaults come from the `setting` key/value table; integrations
 * come from the `integration` table. Falls back to the mock-data static shape
 * for any value that isn't seeded so pages always render.
 */
export async function getSystemProfile(): Promise<SystemProfile> {
  const [settingRows, integrationRows] = await Promise.all([
    db.select().from(setting),
    db.select().from(integration).orderBy(desc(integration.updatedAt)),
  ]);

  const settings = new Map<string, unknown>(settingRows.map((r) => [r.key, r.value]));

  const brokerage: Brokerage = {
    ...mockSystemProfile.brokerage,
    ...((settings.get("brokerage") as Partial<Brokerage> | undefined) ?? {}),
  };

  const defaults: Defaults = {
    ...mockSystemProfile.defaults,
    ...((settings.get("defaults") as Partial<Defaults> | undefined) ?? {}),
  };

  const integrations: Integration[] = integrationRows.length
    ? integrationRows.map((row) => ({
        name: row.name ?? "—",
        note: row.note ?? "",
        status: integrationStatus(row.status),
      }))
    : mockSystemProfile.integrations;

  return { brokerage, integrations, defaults };
}

/* ───────────────────────── Paystack keys ───────────────────────── */

export type PaystackSettings = {
  /** Public key is not sensitive — returned in full for the form. */
  publicKey: string;
  /** True when a secret key is available from either source. */
  secretKeySet: boolean;
  /** Masked secret (e.g. "sk_test…4081") for display only — never the raw key. */
  secretKeyMasked: string;
  /** Where the active secret comes from, for the admin's awareness. */
  source: "Admin settings" | "Environment" | "Not set";
};

/** Show enough of a key to recognise it (mode + last 4) without leaking it. */
function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  const prefix = key.slice(0, key.indexOf("_", 3) + 1 || 7); // "sk_test_" / "sk_live_"
  return `${prefix}…${key.slice(-4)}`;
}

/**
 * Paystack config for the admin settings form. Reads the stored keys (DB) and
 * falls back to env for detecting whether a key exists. The raw secret is NEVER
 * returned — only a masked preview crosses to the client.
 */
export async function getPaystackSettings(): Promise<PaystackSettings> {
  const rows = await db
    .select({ value: setting.value })
    .from(setting)
    .where(eq(setting.key, PAYSTACK_SETTING_KEY))
    .limit(1);
  const stored = (rows[0]?.value as PaystackKeys | null) ?? {};

  const storedSecret = stored.secretKey?.trim();
  const secret = storedSecret || process.env.PAYSTACK_SECRET_KEY || "";
  const publicKey = stored.publicKey?.trim() || process.env.PAYSTACK_PUBLIC_KEY || "";

  const source: PaystackSettings["source"] = storedSecret
    ? "Admin settings"
    : process.env.PAYSTACK_SECRET_KEY
      ? "Environment"
      : "Not set";

  return {
    publicKey,
    secretKeySet: !!secret,
    secretKeyMasked: secret ? maskKey(secret) : "",
    source,
  };
}

/* ───────────────────────── NEM broker credentials ───────────────────────── */

export type NemSettings = {
  baseUrl: string;
  username: string;
  passwordSet: boolean;
  apiKeySet: boolean;
  apiKeyMasked: string;
  source: "Admin settings" | "Environment" | "Not set";
};

/** NEM config for the admin form. Secrets are never returned raw. */
export async function getNemSettings(): Promise<NemSettings> {
  const c = await resolveNemConfig();
  return {
    baseUrl: c.baseUrl,
    username: c.username ?? "",
    passwordSet: !!c.password,
    apiKeySet: !!c.apiKey,
    apiKeyMasked: c.apiKey ? maskKey(c.apiKey) : "",
    source: c.source,
  };
}

/* ───────────────────────── SwiftCheck (KYC) credentials ───────────────────────── */

export type SwiftCheckSettings = {
  baseUrl: string;
  clientId: string;
  clientSecretSet: boolean;
  clientSecretMasked: string;
  source: "Admin settings" | "Environment" | "Not set";
};

/** SwiftCheck config for the admin form. The secret is never returned raw. */
export async function getSwiftCheckSettings(): Promise<SwiftCheckSettings> {
  const c = await resolveSwiftCheckConfig();
  return {
    baseUrl: c.baseUrl,
    clientId: c.clientId ?? "",
    clientSecretSet: !!c.clientSecret,
    clientSecretMasked: c.clientSecret ? maskKey(c.clientSecret) : "",
    source: c.source,
  };
}

/* ───────────────────────── 13 · Reports ───────────────────────── */

type Report = typeof mockReports[number];

/**
 * The scheduled-report catalogue for /admin/reports. This list is configuration
 * rather than transactional data, so it's stored under the `reports` setting
 * key when present, otherwise the static catalogue is returned.
 */
export async function getReports(): Promise<Report[]> {
  const rows = await db.select().from(setting);
  const stored = rows.find((r) => r.key === "reports")?.value as Report[] | undefined;
  return stored && Array.isArray(stored) && stored.length ? stored : mockReports;
}
