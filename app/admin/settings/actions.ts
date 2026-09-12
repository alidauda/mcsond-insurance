"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { setting } from "@/lib/schema";
import { PAYSTACK_SETTING_KEY, type PaystackKeys } from "@/lib/paystack";
import { NEM_SETTING_KEY, getVehicleTypes, getVehicleMakes, resolveNemConfig, type NemCredentials } from "@/lib/nem";
import {
  SWIFTCHECK_SETTING_KEY,
  getRequestReasons,
  resolveSwiftCheckConfig,
  type SwiftCheckCredentials,
} from "@/lib/swiftcheck";
import { requirePermission } from "@/lib/server-session";

export type SettingsResult = { ok: boolean; message: string } | null;

/**
 * Save the Paystack keys to the `setting` table (key = "paystack"). Only staff
 * with `settings:manage` (superadmin) may change them. The secret field is
 * write-only: an empty submission keeps the stored secret, so the masked
 * preview shown in the form is never round-tripped back as the value.
 */
export async function savePaystackKeys(
  _prev: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  try {
    await requirePermission({ settings: ["manage"] });
  } catch {
    return { ok: false, message: "You don't have permission to change payment keys." };
  }

  const publicKey = String(formData.get("publicKey") ?? "").trim();
  const secretKeyInput = String(formData.get("secretKey") ?? "").trim();

  if (publicKey && !publicKey.startsWith("pk_")) {
    return { ok: false, message: "Public key should start with pk_." };
  }
  if (secretKeyInput && !secretKeyInput.startsWith("sk_")) {
    return { ok: false, message: "Secret key should start with sk_." };
  }

  // Load existing so a blank secret field preserves the stored key.
  const rows = await db
    .select({ value: setting.value })
    .from(setting)
    .where(eq(setting.key, PAYSTACK_SETTING_KEY))
    .limit(1);
  const existing = (rows[0]?.value as PaystackKeys | null) ?? {};

  const value: PaystackKeys = {
    publicKey: publicKey || existing.publicKey || "",
    secretKey: secretKeyInput || existing.secretKey || "",
  };

  if (rows[0]) {
    await db.update(setting).set({ value }).where(eq(setting.key, PAYSTACK_SETTING_KEY));
  } else {
    await db.insert(setting).values({ key: PAYSTACK_SETTING_KEY, value });
  }

  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: secretKeyInput ? "Paystack keys saved." : "Saved — secret key left unchanged.",
  };
}

/**
 * Save NEM broker credentials (setting key = "nem"). Password and API key are
 * write-only: a blank submission keeps the stored value.
 */
export async function saveNemCredentials(
  _prev: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  try {
    await requirePermission({ settings: ["manage"] });
  } catch {
    return { ok: false, message: "You don't have permission to change underwriter credentials." };
  }

  const baseUrl = String(formData.get("baseUrl") ?? "").trim().replace(/\/+$/, "");
  const username = String(formData.get("username") ?? "").trim();
  const passwordInput = String(formData.get("password") ?? "").trim();
  const apiKeyInput = String(formData.get("apiKey") ?? "").trim();

  if (baseUrl && !/^https:\/\/[^\s/]+/.test(baseUrl)) {
    return { ok: false, message: "Base URL must be an https:// host." };
  }

  const rows = await db
    .select({ value: setting.value })
    .from(setting)
    .where(eq(setting.key, NEM_SETTING_KEY))
    .limit(1);
  const existing = (rows[0]?.value as NemCredentials | null) ?? {};

  const value: NemCredentials = {
    baseUrl: baseUrl || existing.baseUrl || "",
    username: username || existing.username || "",
    password: passwordInput || existing.password || "",
    apiKey: apiKeyInput || existing.apiKey || "",
  };

  if (rows[0]) {
    await db.update(setting).set({ value }).where(eq(setting.key, NEM_SETTING_KEY));
  } else {
    await db.insert(setting).values({ key: NEM_SETTING_KEY, value });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/insurance");
  return {
    ok: true,
    message: passwordInput || apiKeyInput ? "NEM credentials saved." : "Saved — secrets left unchanged.",
  };
}

/**
 * Live, read-only check against NEM: fetches the reference lists from the
 * configured host. Credentials are not exercised here (NEM has no auth
 * endpoint and its purchase calls have side effects) — they are validated by
 * the first real purchase, which fails cleanly with a refund if rejected.
 */
export async function testNemConnection(): Promise<SettingsResult> {
  try {
    await requirePermission({ settings: ["view"] });
  } catch {
    return { ok: false, message: "You don't have permission to view underwriter settings." };
  }
  const cfg = await resolveNemConfig();
  const credentials = cfg.username && cfg.password && cfg.apiKey ? "credentials set" : "credentials NOT set";
  try {
    const [types, makes] = await Promise.all([getVehicleTypes(), getVehicleMakes()]);
    return {
      ok: true,
      message: `Reached ${cfg.baseUrl}: ${types.length} vehicle types, ${makes.length} makes · ${credentials}.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reach NEM." };
  }
}

/**
 * Save SwiftCheck (KYC) credentials, setting key = "swiftcheck". The client
 * secret is write-only: a blank submission keeps the stored value.
 */
export async function saveSwiftCheckCredentials(
  _prev: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  try {
    await requirePermission({ settings: ["manage"] });
  } catch {
    return { ok: false, message: "You don't have permission to change identity-check credentials." };
  }

  const baseUrl = String(formData.get("baseUrl") ?? "").trim().replace(/\/+$/, "");
  const clientId = String(formData.get("clientId") ?? "").trim();
  const secretInput = String(formData.get("clientSecret") ?? "").trim();

  if (baseUrl && !/^https:\/\/[^\s/]+/.test(baseUrl)) {
    return { ok: false, message: "Base URL must be an https:// host." };
  }

  const rows = await db
    .select({ value: setting.value })
    .from(setting)
    .where(eq(setting.key, SWIFTCHECK_SETTING_KEY))
    .limit(1);
  const existing = (rows[0]?.value as SwiftCheckCredentials | null) ?? {};

  const value: SwiftCheckCredentials = {
    baseUrl: baseUrl || existing.baseUrl || "",
    clientId: clientId || existing.clientId || "",
    clientSecret: secretInput || existing.clientSecret || "",
  };

  if (rows[0]) {
    await db.update(setting).set({ value }).where(eq(setting.key, SWIFTCHECK_SETTING_KEY));
  } else {
    await db.insert(setting).values({ key: SWIFTCHECK_SETTING_KEY, value });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/kyc");
  return { ok: true, message: secretInput ? "SwiftCheck credentials saved." : "Saved — client secret left unchanged." };
}

/**
 * Live check against SwiftCheck. `request-reasons` needs valid credentials but
 * costs no verification unit, so it doubles as a credential test.
 */
export async function testSwiftCheckConnection(): Promise<SettingsResult> {
  try {
    await requirePermission({ settings: ["view"] });
  } catch {
    return { ok: false, message: "You don't have permission to view identity-check settings." };
  }
  const cfg = await resolveSwiftCheckConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    return { ok: false, message: "No SwiftCheck credentials are configured yet." };
  }
  try {
    const reasons = await getRequestReasons();
    return { ok: true, message: `Reached ${cfg.baseUrl} — credentials accepted, ${reasons.length} request reasons available.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reach SwiftCheck." };
  }
}
