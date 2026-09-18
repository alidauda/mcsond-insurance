"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getVerifiedPolicyholder } from "@/lib/kyc";
import { requireCustomer } from "@/lib/server-session";
import { getKycStatus } from "@/lib/kyc";
import { getInsurancePlan } from "@/lib/catalog";
import {
  bindMotorPolicy,
  quoteMotorPremium,
  UnderwriterError,
} from "@/lib/policy-mutations";
import { InsufficientFundsError } from "@/lib/wallet-mutations";
import { getVehicleModels, NemApiError, NemNetworkError, type NemOption, type VehicleUsage } from "@/lib/nem";
import { naira } from "@/lib/format";
import type { NemProductCode } from "@/lib/mock-data";

export type MotorBindState = { ok: false; message: string } | null;

const TITLES = ["Mr", "Mrs", "Miss", "Ms", "Dr", "Chief", "Alhaji", "Alhaja"] as const;
const ID_TYPES = ["International Passport", "Driver's Licence", "National ID (NIN)", "Voter's Card"] as const;
const MAX_VEHICLE_VALUE = 2_000_000_000;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function isoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
}

/** Cascading vehicle models for a make (customer-facing, read-only). */
export async function loadVehicleModels(makeCode: string): Promise<NemOption[]> {
  await requireCustomer();
  try {
    return await getVehicleModels(makeCode);
  } catch {
    return [];
  }
}

export type PremiumQuote = { ok: true; premium: number } | { ok: false; message: string };

/** Live NEM premium for the current form inputs. */
export async function quotePremium(input: {
  plan: string;
  vehicleTypeId: number;
  usage: VehicleUsage;
  vehicleValue?: number;
  excessBuyBack?: boolean;
  variant?: string;
}): Promise<PremiumQuote> {
  await requireCustomer();
  const plan = await getInsurancePlan(input.plan);
  if (!plan || plan.provider !== "nem" || !plan.productCode) {
    return { ok: false, message: "This plan is not priced by NEM." };
  }
  try {
    const premium = await quoteMotorPremium(plan.productCode, input);
    return { ok: true, premium };
  } catch (err) {
    if (err instanceof NemApiError || err instanceof NemNetworkError) return { ok: false, message: err.message };
    return { ok: false, message: "Couldn't fetch a premium from NEM." };
  }
}

/** Customer binds a NEM motor policy: validates, debits the wallet, issues with NEM, redirects to the certificate. */
export async function bindMotorPolicyAction(
  _prev: MotorBindState,
  formData: FormData,
): Promise<MotorBindState> {
  const me = await requireCustomer();

  // NAICOM/AML: cover cannot be bound for an unverified identity.
  if ((await getKycStatus(me.id)) !== "verified") {
    return {
      ok: false,
      message: "Verify your identity before binding cover — it takes a few seconds on the Identity check page.",
    };
  }

  const planReference = str(formData, "plan");
  const plan = await getInsurancePlan(planReference);
  if (!plan || plan.provider !== "nem" || !plan.productCode) {
    return { ok: false, message: "That plan is no longer available — pick another." };
  }
  const product: NemProductCode = plan.productCode;

  // ── policyholder ──
  // A verified customer's identity comes from the national record, never the
  // form — the UI doesn't even render those fields, and posting them changes
  // nothing. Unverified customers type them (and are gated by KycGate anyway).
  const verified = await getVerifiedPolicyholder(me.id);
  const title = str(formData, "title");
  const firstName = verified?.firstName ?? str(formData, "firstName");
  const lastName = verified?.lastName ?? str(formData, "lastName");
  const dob = verified?.dob ?? str(formData, "dob");
  const sexRaw = verified?.sex ?? str(formData, "sex");
  const phone = str(formData, "phone").replace(/\s+/g, "");
  const address = str(formData, "address");
  const occupation = str(formData, "occupation");
  const idType = str(formData, "idType");
  const idNo = str(formData, "idNo");
  const state = str(formData, "state");
  const tin = str(formData, "tin");
  const companyName = str(formData, "companyName");

  if (!(TITLES as readonly string[]).includes(title)) return { ok: false, message: "Choose a title." };
  if (firstName.length < 2 || lastName.length < 2) return { ok: false, message: "Enter the policyholder's first and last name." };
  if (!isoDate(dob)) return { ok: false, message: "Enter a valid date of birth." };
  const age = (Date.now() - new Date(`${dob}T00:00:00`).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 18 || age > 110) return { ok: false, message: "The policyholder must be at least 18." };
  if (sexRaw !== "male" && sexRaw !== "female") return { ok: false, message: "Choose the policyholder's sex." };
  if (!/^\+?\d{10,14}$/.test(phone)) return { ok: false, message: "Enter a valid phone number (digits only)." };
  if (address.length < 6) return { ok: false, message: "Enter the policyholder's address." };
  if (!occupation) return { ok: false, message: "Enter an occupation." };
  if (!(ID_TYPES as readonly string[]).includes(idType)) return { ok: false, message: "Choose an ID type." };
  if (idNo.length < 4) return { ok: false, message: "Enter the ID number." };
  if (!state) return { ok: false, message: "Enter the state of residence." };

  // ── vehicle ──
  const makeCode = str(formData, "makeCode");
  const modelCode = str(formData, "modelCode");
  const color = str(formData, "color");
  const regNo = str(formData, "regNo").toUpperCase();
  const engineNo = str(formData, "engineNo").toUpperCase();
  const chassisNo = str(formData, "chassisNo").toUpperCase();
  const year = str(formData, "year");
  const vehicleTypeId = Number(str(formData, "vehicleTypeId"));
  const vehicleTypeName = str(formData, "vehicleTypeName");
  const usageRaw = str(formData, "usage");

  if (!makeCode || !modelCode) return { ok: false, message: "Choose the vehicle make and model." };
  if (!color) return { ok: false, message: "Enter the vehicle colour." };
  if (!/^[A-Z0-9 -]{5,12}$/.test(regNo)) return { ok: false, message: "Enter a valid registration number." };
  if (engineNo.length < 5) return { ok: false, message: "Enter the engine number." };
  if (chassisNo.length < 5) return { ok: false, message: "Enter the chassis (VIN) number." };
  const yearNum = Number(year);
  const thisYear = new Date().getFullYear();
  if (!Number.isInteger(yearNum) || yearNum < 1970 || yearNum > thisYear + 1) {
    return { ok: false, message: "Enter a valid vehicle year." };
  }
  if (!Number.isInteger(vehicleTypeId) || vehicleTypeId < 1 || !vehicleTypeName) {
    return { ok: false, message: "Choose the vehicle type." };
  }
  if (usageRaw !== "Private" && usageRaw !== "Commercial") return { ok: false, message: "Choose the vehicle usage." };
  const usage: VehicleUsage = usageRaw;

  // ── cover ──
  const startDate = str(formData, "startDate");
  if (!isoDate(startDate)) return { ok: false, message: "Choose a valid start date." };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(`${startDate}T00:00:00`).getTime() < today.getTime()) {
    return { ok: false, message: "Cover can't start in the past — pick today or later." };
  }

  let vehicleValue: number | undefined;
  let excessBuyBack: boolean | undefined;
  let variant: string | undefined;
  if (product === "comp") {
    vehicleValue = Number(str(formData, "vehicleValue").replace(/[,\s₦]/g, ""));
    if (!Number.isInteger(vehicleValue) || vehicleValue < 100_000) {
      return { ok: false, message: "Enter the vehicle's value (at least ₦100,000)." };
    }
    if (vehicleValue > MAX_VEHICLE_VALUE) return { ok: false, message: "That vehicle value looks too large." };
    excessBuyBack = str(formData, "excessBuyBack") === "on";
  }
  if (product === "emtp") {
    variant = str(formData, "variant");
    if (!/^Type [A-Z]$/.test(variant)) return { ok: false, message: "Choose an enhanced cover variant." };
  }

  // ── inspection (comp & emtp) ──
  let inspection = null;
  if (product !== "mtp") {
    const insAddress = str(formData, "insAddress");
    const insContact = str(formData, "insContact").replace(/\s+/g, "");
    const insDate = str(formData, "insDate");
    const insPerson = str(formData, "insPerson");
    const insBranch = str(formData, "insBranch");
    if (insAddress.length < 6) return { ok: false, message: "Enter the inspection address." };
    if (!/^\+?\d{10,14}$/.test(insContact)) return { ok: false, message: "Enter a valid inspection contact number." };
    if (!isoDate(insDate)) return { ok: false, message: "Choose the inspection date." };
    if (new Date(`${insDate}T00:00:00`).getTime() < today.getTime()) {
      return { ok: false, message: "The inspection date can't be in the past." };
    }
    if (insPerson.length < 2) return { ok: false, message: "Enter who will present the vehicle for inspection." };
    if (!insBranch) return { ok: false, message: "Choose the NEM branch for the inspection." };
    inspection = { address: insAddress, contact: insContact, date: insDate, person: insPerson, branchCode: insBranch };
  }

  let reference: string;
  try {
    ({ reference } = await bindMotorPolicy({
      userId: me.id,
      planReference,
      startDate,
      customer: {
        email: me.email,
        title,
        firstName,
        lastName,
        dob,
        sex: sexRaw,
        phone,
        address,
        occupation,
        idType,
        idNo,
        state,
        tin,
        companyName,
      },
      vehicle: { makeCode, modelCode, color, regNo, engineNo, chassisNo, year, vehicleTypeId, vehicleTypeName, usage },
      inspection,
      vehicleValue,
      excessBuyBack,
      variant,
    }));
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return {
        ok: false,
        message: `Your wallet is ${naira(err.shortfall)} short for this policy — top it up, then bind.`,
      };
    }
    if (err instanceof UnderwriterError) {
      return {
        ok: false,
        message: `${err.message} Nothing was charged — the premium was returned to your wallet (ref ${err.reference}).`,
      };
    }
    if (err instanceof NemApiError || err instanceof NemNetworkError) {
      return { ok: false, message: err.message };
    }
    console.error("bindMotorPolicyAction failed:", err);
    return { ok: false, message: "Something went wrong binding the policy — try again." };
  }

  revalidatePath("/wallet");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/admin/orders");
  redirect(`/insurance/certificate/${encodeURIComponent(reference)}?bound=1`);
}
