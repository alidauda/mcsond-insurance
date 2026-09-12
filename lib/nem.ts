import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { setting } from "./schema";

/**
 * NEM Insurance eInsurance retail-broker API client.
 *
 * Source of truth: the "InsuranceBrokerApi" Postman collection (sandbox host).
 * All calls are plain JSON over HTTPS; the broker credentials travel in the
 * POST body (username / password / apiKey), never in headers. The API always
 * answers HTTP 200 — outcomes live in `respCode` (200 = ok, 300 = validation /
 * duplicate credit note, 202 = bad credentials, 5xx = save failures) — and a
 * malformed payload yields an HTML PHP error page, so every body is parsed
 * defensively.
 *
 * Products:
 *   mtp  — Motor Third Party         POST /buyMtp   (premium by vehicle type)
 *   emtp — Enhanced Third Party      POST /buyEmtp  (premium by variant Type A/B…)
 *   comp — Comprehensive (single)    POST /buyComp  (premium = % of vehicle value)
 *
 * Credentials: Admin → Settings (setting key "nem") override NEM_* env vars.
 */

export const NEM_SETTING_KEY = "nem";
export const NEM_DEFAULT_BASE_URL = "https://sandbox.einsurance.nem-insurance.com";

export type NemCredentials = {
  baseUrl?: string;
  username?: string;
  password?: string;
  apiKey?: string;
};

export type NemConfig = {
  baseUrl: string;
  username: string | null;
  password: string | null;
  apiKey: string | null;
  source: "Admin settings" | "Environment" | "Not set";
};

async function storedCredentials(): Promise<NemCredentials> {
  try {
    const rows = await db
      .select({ value: setting.value })
      .from(setting)
      .where(eq(setting.key, NEM_SETTING_KEY))
      .limit(1);
    return (rows[0]?.value as NemCredentials | null) ?? {};
  } catch {
    return {}; // DB unreachable → fall back to env
  }
}

/** Resolve the active NEM config (DB override → env). */
export async function resolveNemConfig(): Promise<NemConfig> {
  const stored = await storedCredentials();
  const username = stored.username?.trim() || process.env.NEM_USERNAME || null;
  const password = stored.password?.trim() || process.env.NEM_PASSWORD || null;
  const apiKey = stored.apiKey?.trim() || process.env.NEM_API_KEY || null;
  const baseUrl = (stored.baseUrl?.trim() || process.env.NEM_BASE_URL || NEM_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const source: NemConfig["source"] = stored.apiKey?.trim()
    ? "Admin settings"
    : process.env.NEM_API_KEY
      ? "Environment"
      : "Not set";
  return { baseUrl, username, password, apiKey, source };
}

/** True when broker credentials are available from either source. */
export async function isNemConfigured(): Promise<boolean> {
  const c = await resolveNemConfig();
  return !!(c.username && c.password && c.apiKey);
}

/* ───────────────────────── errors ───────────────────────── */

/** NEM answered, but with a non-200 respCode (validation, duplicate, auth…). */
export class NemApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public raw?: unknown,
  ) {
    super(message);
  }
}

/** We never got a usable answer from NEM (network, timeout, HTML error page). */
export class NemNetworkError extends Error {}

/** Friendly copy for the documented respCodes. */
export function describeNemError(code: number, fallback: string): string {
  switch (code) {
    case 202:
      return "NEM rejected the broker credentials — check them in Admin → Settings.";
    case 300:
      return fallback || "NEM reported missing or invalid fields.";
    case 301:
      return "NEM could not save the vehicle owner's details.";
    case 302:
      return "NEM does not recognise this broker account.";
    case 501:
      return "NEM already holds an identical policy for this vehicle.";
    case 502:
      return "NEM could not save the vehicle details.";
    case 600:
      return "NEM rejected the transaction reference as not unique.";
    default:
      return fallback || "NEM declined the request.";
  }
}

/* ───────────────────────── transport ───────────────────────── */

const GET_TIMEOUT_MS = 20_000;
const POST_TIMEOUT_MS = 45_000;

type Envelope = { respCode?: number | string; response?: string; respData?: unknown };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function nemGet<T>(path: string): Promise<T> {
  const { baseUrl } = await resolveNemConfig();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(GET_TIMEOUT_MS),
    });
  } catch (err) {
    throw new NemNetworkError(`Could not reach NEM: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = await res.text();
  const json = parseJson(text);
  if (json === undefined) throw new NemNetworkError("NEM returned an unreadable response.");
  const env = json as Envelope;
  if (env && typeof env === "object" && "respCode" in env && Number(env.respCode) !== 200) {
    throw new NemApiError(Number(env.respCode), env.response ?? "NEM request failed", json);
  }
  return json as T;
}

/** POST with the broker credentials merged in. Never retried (purchases aren't idempotent). */
async function nemPost<T extends Envelope>(path: string, body: Record<string, unknown>): Promise<T> {
  const cfg = await resolveNemConfig();
  if (!cfg.username || !cfg.password || !cfg.apiKey) {
    throw new NemNetworkError("NEM broker credentials are not configured — set them in Admin → Settings.");
  }
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cfg.username, password: cfg.password, apiKey: cfg.apiKey, ...body }),
      cache: "no-store",
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new NemNetworkError(`Could not reach NEM: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = await res.text();
  const json = parseJson(text) as T | undefined;
  if (!json || typeof json !== "object") {
    // The sandbox emits a PHP warning page for missing fields — surface it cleanly.
    throw new NemNetworkError("NEM returned an unreadable response (likely a missing or malformed field).");
  }
  const code = Number(json.respCode);
  if (code !== 200) throw new NemApiError(code, json.response ?? "NEM request failed", json);
  return json;
}

/* ───────────────────────── reference data (memoised) ───────────────────────── */

export type NemOption = { code: string; name: string };

export type NemVehicleType = {
  id: number;
  name: string;
  privatePrice: number;
  commercialPrice: number;
  premiumRatio: number;
  buyback: number;
  comprehensive: boolean;
};

export type NemEnhancedType = {
  id: number;
  name: string; // "Type A"
  premium: number;
  thirdPartyDamage: number;
  injuryDeath: string; // "Unlimited"
  ownDamage: number;
  medicalExpenses: number;
  legal: number;
  towing: number;
};

const REF_TTL_MS = 60 * 60 * 1000;
const refCache = new Map<string, { at: number; value: unknown }>();

async function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = refCache.get(key);
  if (hit && Date.now() - hit.at < REF_TTL_MS) return hit.value as T;
  const value = await load();
  refCache.set(key, { at: Date.now(), value });
  return value;
}

/** NEM lists repeat entries; keep the first occurrence of each code, sorted by name. */
function dedupeOptions(rows: { itemdesc?: string; code_to_use?: string }[] | undefined): NemOption[] {
  const seen = new Map<string, NemOption>();
  for (const r of rows ?? []) {
    const code = String(r.code_to_use ?? "").trim();
    const name = String(r.itemdesc ?? "").trim();
    if (!code || !name || seen.has(code)) continue;
    seen.set(code, { code, name });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getVehicleTypes(): Promise<NemVehicleType[]> {
  return memo("vehicleTypes", async () => {
    const rows = await nemGet<
      {
        id: number;
        vehicle_type_name: string;
        private_price: number;
        commercial_price: number;
        premium_ratio: number;
        buyback: number;
        comp: number | null;
      }[]
    >("/vehicleTypes");
    return (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id),
      name: String(r.vehicle_type_name ?? "").trim(),
      privatePrice: Number(r.private_price ?? 0),
      commercialPrice: Number(r.commercial_price ?? 0),
      premiumRatio: Number(r.premium_ratio ?? 0),
      buyback: Number(r.buyback ?? 0),
      comprehensive: Number(r.comp ?? 0) === 1,
    }));
  });
}

export async function getVehicleMakes(): Promise<NemOption[]> {
  return memo("vehicleMakes", async () => {
    const data = await nemGet<{ VEHICLEMAKELISTS?: { itemdesc: string; code_to_use: string }[] }>("/VehicleMakes");
    return dedupeOptions(data.VEHICLEMAKELISTS);
  });
}

export async function getVehicleModels(makeCode: string): Promise<NemOption[]> {
  const code = makeCode.replace(/[^0-9A-Za-z]/g, "");
  if (!code) return [];
  return memo(`vehicleModels:${code}`, async () => {
    const data = await nemGet<{ VEHICLE_MODEL_LISTS?: { itemdesc: string; code_to_use: string }[] }>(
      `/VehicleModels/${encodeURIComponent(code)}`,
    );
    return dedupeOptions(data.VEHICLE_MODEL_LISTS);
  });
}

/** NEM branch locations ("States" endpoint) — used for the inspection branch code. */
export async function getBranchLocations(): Promise<NemOption[]> {
  return memo("branchLocations", async () => {
    const data = await nemGet<{ BUSINESS_LOCATION_LISTS?: { itemdesc: string; code_to_use: string }[] }>("/States");
    return dedupeOptions(data.BUSINESS_LOCATION_LISTS);
  });
}

export async function getEnhancedTypes(): Promise<NemEnhancedType[]> {
  return memo("enhancedTypes", async () => {
    const data = await nemGet<{
      respData?: {
        id: number;
        name: string;
        damage: string;
        injury_death: string;
        own_damage: string;
        medical_expenses: string;
        legal: string;
        towing: string;
        premium: string;
      }[];
    }>("/EnhancedTypes");
    return (data.respData ?? []).map((r) => ({
      id: Number(r.id),
      name: String(r.name).trim(),
      premium: Number(r.premium ?? 0),
      thirdPartyDamage: Number(r.damage ?? 0),
      injuryDeath: String(r.injury_death ?? "—"),
      ownDamage: Number(r.own_damage ?? 0),
      medicalExpenses: Number(r.medical_expenses ?? 0),
      legal: Number(r.legal ?? 0),
      towing: Number(r.towing ?? 0),
    }));
  });
}

/* ───────────────────────── premiums (live) ───────────────────────── */

export type VehicleUsage = "Private" | "Commercial";

/** Third-party premium is a flat rate per vehicle type and usage. */
export async function getThirdPartyPremium(vehicleTypeId: number, usage: VehicleUsage): Promise<number> {
  const types = await getVehicleTypes();
  const t = types.find((x) => x.id === vehicleTypeId);
  if (!t) throw new NemApiError(300, "Unknown vehicle type.");
  return usage === "Commercial" ? t.commercialPrice : t.privatePrice;
}

/** Comprehensive premium for a vehicle value, type and excess buy-back flag. */
export async function getComprehensivePremium(
  vehicleValue: number,
  vehicleTypeId: number,
  excessBuyBack: boolean,
): Promise<number> {
  const value = Math.round(vehicleValue);
  const data = await nemGet<{ respData?: number | string }>(
    `/ComprehensivePremium/${value}/${vehicleTypeId}/${excessBuyBack ? 1 : 0}`,
  );
  const premium = Number(data.respData ?? 0);
  if (!Number.isFinite(premium) || premium <= 0) throw new NemApiError(300, "NEM returned no premium for this vehicle.");
  return Math.round(premium);
}

/** Enhanced third-party premium for a variant ("Type A", "Type B"…). */
export async function getEnhancedPremium(variant: string): Promise<number> {
  const data = await nemGet<{ respData?: number | string }>(`/EnhancedPremium/${encodeURIComponent(variant)}`);
  const premium = Number(data.respData ?? 0);
  if (!Number.isFinite(premium) || premium <= 0) throw new NemApiError(300, "NEM returned no premium for this variant.");
  return Math.round(premium);
}

/* ───────────────────────── purchase ───────────────────────── */

export type NemCustomer = {
  email: string;
  title: string; // Mr | Mrs | Miss | Dr …
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  sex: "male" | "female";
  phone: string;
  address: string;
  occupation: string;
  idType: string;
  idNo: string;
  state: string;
  tin: string;
  companyName: string;
};

export type NemVehicle = {
  makeCode: string;
  modelCode: string;
  color: string;
  regNo: string;
  engineNo: string;
  chassisNo: string;
  year: string;
  vehicleTypeId: number;
  vehicleTypeName: string;
  usage: VehicleUsage;
};

export type NemInspection = {
  address: string;
  contact: string;
  date: string; // YYYY-MM-DD
  person: string;
  branchCode: string;
};

export type NemPurchaseResult = {
  transRef: string;
  policyNo: string;
  naicomId: string | null;
  certName: string | null;
  certificateUrl: string | null;
  debitNoteUrl: string | null;
  creditNoteUrl: string | null;
  raw: Record<string, unknown>;
};

/** "2026-09-10" → "10/09/2026" (NEM expects day-first for dob / inspection). */
export function toNemDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function commonPayload(c: NemCustomer, v: NemVehicle, startDate: string, creditNoteNo: string) {
  return {
    email: c.email,
    title: c.title,
    fname: c.firstName,
    lname: c.lastName,
    dob: toNemDate(c.dob),
    sex: c.sex,
    phone_no: c.phone,
    address: c.address,
    occupation: c.occupation,
    id_type: c.idType,
    id_no: c.idNo,
    state: c.state,
    tin: c.tin,
    comp_name: c.companyName,
    startDate, // YYYY-MM-DD, as in the collection
    model: v.modelCode,
    brand: v.makeCode,
    color: v.color,
    reg_no: v.regNo,
    eng_no: v.engineNo,
    chasis_no: v.chassisNo,
    year: v.year,
    veh_usage: v.usage,
    credit_note_no: creditNoteNo,
  };
}

function inspectionPayload(i: NemInspection) {
  return {
    ins_address: i.address,
    ins_contact: i.contact,
    ins_date: toNemDate(i.date),
    ins_person: i.person,
    ins_state: i.branchCode,
  };
}

type PurchaseEnvelope = Envelope & {
  TransRef?: string;
  TransactionId?: string;
  PolicyNo?: string;
  PolicyId?: string;
  NaicomID?: string | null;
  certName?: string;
  Certificate?: string;
  link?: string;
  debitLink?: string;
  creditLink?: string;
};

function toResult(json: PurchaseEnvelope): NemPurchaseResult {
  return {
    transRef: String(json.TransRef ?? json.TransactionId ?? ""),
    policyNo: String(json.PolicyNo ?? json.PolicyId ?? ""),
    naicomId: json.NaicomID ? String(json.NaicomID) : null,
    certName: json.certName ?? json.Certificate ?? null,
    certificateUrl: json.link ?? null,
    debitNoteUrl: json.debitLink ?? null,
    creditNoteUrl: json.creditLink ?? null,
    raw: json as Record<string, unknown>,
  };
}

/** Strip broker credentials before persisting a request for audit. */
export function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const { username: _u, password: _p, apiKey: _k, ...rest } = payload;
  void _u;
  void _p;
  void _k;
  return rest;
}

export type NemPurchase =
  | { product: "mtp"; customer: NemCustomer; vehicle: NemVehicle; startDate: string; creditNoteNo: string }
  | {
      product: "emtp";
      customer: NemCustomer;
      vehicle: NemVehicle;
      startDate: string;
      creditNoteNo: string;
      variant: string;
      premium: number;
      inspection: NemInspection;
    }
  | {
      product: "comp";
      customer: NemCustomer;
      vehicle: NemVehicle;
      startDate: string;
      creditNoteNo: string;
      vehicleValue: number;
      excessBuyBack: boolean;
      inspection: NemInspection;
    };

export const NEM_ENDPOINT: Record<NemPurchase["product"], string> = {
  mtp: "/buyMtp",
  emtp: "/buyEmtp",
  comp: "/buyComp",
};

/** Build the exact JSON body NEM expects for a product (without credentials). */
export function buildPurchasePayload(p: NemPurchase): Record<string, unknown> {
  const base = commonPayload(p.customer, p.vehicle, p.startDate, p.creditNoteNo);
  switch (p.product) {
    case "mtp":
      return { ...base, type: p.vehicle.vehicleTypeName };
    case "emtp":
      return {
        ...base,
        type: p.vehicle.vehicleTypeName,
        policyType: p.variant,
        amount: String(p.premium),
        ...inspectionPayload(p.inspection),
      };
    case "comp":
      return {
        ...base,
        type: p.vehicle.vehicleTypeId,
        costOfVeh: Math.round(p.vehicleValue),
        exBuyBack: p.excessBuyBack ? 1 : 0,
        ...inspectionPayload(p.inspection),
      };
  }
}

/** Issue a policy with NEM. Throws NemApiError / NemNetworkError. */
export async function purchase(p: NemPurchase): Promise<NemPurchaseResult> {
  const json = await nemPost<PurchaseEnvelope>(NEM_ENDPOINT[p.product], buildPurchasePayload(p));
  const result = toResult(json);
  if (!result.policyNo) throw new NemApiError(500, "NEM did not return a policy number.", json);
  return result;
}
