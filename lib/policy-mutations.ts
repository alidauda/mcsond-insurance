import "server-only";
import { randomUUID, randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { order, insurancePolicy, insurancePlan, underwriterTransaction, wallet } from "./schema";
// McSond is a broker: every policy here is priced and issued by an
// underwriter's API. Nothing in this module invents a policy number.
import { applyWalletMovement } from "./wallet-mutations";
import {
  purchase as nemPurchase,
  buildPurchasePayload,
  redactPayload,
  getThirdPartyPremium,
  getEnhancedPremium,
  getComprehensivePremium,
  NemApiError,
  NemNetworkError,
  describeNemError,
  NEM_ENDPOINT,
  type NemCustomer,
  type NemVehicle,
  type NemInspection,
  type NemPurchase,
} from "./nem";
import type { NemProductCode } from "./mock-data";

import { priceQuote, periodEndFor } from "./quote";

export {
  STAMP_DUTY_RATE,
  INSURANCE_VAT_RATE,
  TERM_OPTIONS,
  RENEWAL_WINDOW_DAYS,
  priceQuote,
  periodEndFor,
  type TermMonths,
  type QuotePricing,
} from "./quote";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function newOrderReference(tx: Tx): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const ref = `INS-${randomInt(0, 10_000).toString().padStart(4, "0")}`;
    const clash = await tx
      .select({ id: order.id })
      .from(order)
      .where(eq(order.reference, ref))
      .limit(1);
    if (!clash[0]) return ref;
  }
  return `INS-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export type BoundPolicy = {
  reference: string;
  policyNo: string;
  total: number;
  balanceAfter: number;
};

/* ───────────────────────── NEM-backed motor policies ───────────────────────── */

/** The underwriter declined or could not be reached; the wallet has been refunded. */
export class UnderwriterError extends Error {
  constructor(
    public code: number,
    message: string,
    public reference: string,
  ) {
    super(message);
  }
}

export type MotorBindParams = {
  userId: string;
  planReference: string;
  startDate: string; // YYYY-MM-DD
  customer: NemCustomer;
  vehicle: NemVehicle;
  inspection?: NemInspection | null;
  /** comp only */
  vehicleValue?: number;
  excessBuyBack?: boolean;
  /** emtp only */
  variant?: string;
};

export type BoundMotorPolicy = BoundPolicy & {
  providerRef: string;
  certificateUrl: string | null;
};

function isProduct(v: unknown): v is NemProductCode {
  return v === "mtp" || v === "comp" || v === "emtp";
}

/** Live premium from NEM for the chosen product/inputs (never trusts the client). */
export async function quoteMotorPremium(
  product: NemProductCode,
  input: { vehicleTypeId: number; usage: "Private" | "Commercial"; vehicleValue?: number; excessBuyBack?: boolean; variant?: string },
): Promise<number> {
  switch (product) {
    case "mtp":
      return getThirdPartyPremium(input.vehicleTypeId, input.usage);
    case "emtp":
      if (!input.variant) throw new NemApiError(300, "Choose an enhanced cover variant.");
      return getEnhancedPremium(input.variant);
    case "comp":
      if (!input.vehicleValue || input.vehicleValue < 1) throw new NemApiError(300, "Enter the vehicle value.");
      return getComprehensivePremium(input.vehicleValue, input.vehicleTypeId, !!input.excessBuyBack);
  }
}

/**
 * Bind a NEM-backed motor policy — a two-phase saga:
 *  1. Debit the wallet and create the order/policy in stage "pending" (one tx).
 *  2. Call NEM's purchase endpoint.
 *     • success → policy takes NEM's policy no., refs and certificate links; order "active".
 *     • failure → wallet refunded, order "failed"; the attempt is logged either way.
 * Throws InsufficientFundsError before anything is written, UnderwriterError after a refund.
 */
export async function bindMotorPolicy(params: MotorBindParams): Promise<BoundMotorPolicy> {
  const plans = await db
    .select()
    .from(insurancePlan)
    .where(and(eq(insurancePlan.reference, params.planReference), eq(insurancePlan.active, true)))
    .limit(1);
  const plan = plans[0];
  if (!plan) throw new Error("PLAN_NOT_FOUND");
  if (plan.provider !== "nem" || !isProduct(plan.productCode)) throw new Error("NOT_A_NEM_PLAN");
  const product = plan.productCode;

  if ((product === "comp" || product === "emtp") && !params.inspection) {
    throw new NemApiError(300, "Inspection details are required for this cover.");
  }

  // Phase 0 — price it live with NEM. Motor policies are annual.
  const premium = await quoteMotorPremium(product, {
    vehicleTypeId: params.vehicle.vehicleTypeId,
    usage: params.vehicle.usage,
    vehicleValue: params.vehicleValue,
    excessBuyBack: params.excessBuyBack,
    variant: params.variant,
  });
  const termMonths = 12;
  const pricing = priceQuote(premium, termMonths);
  const underwriter = plan.underwriter ?? "NEM Insurance";
  const periodStart = new Date(`${params.startDate}T00:00:00`);
  const periodEnd = periodEndFor(periodStart, termMonths);
  const insuredParty = params.customer.companyName || `${params.customer.firstName} ${params.customer.lastName}`.trim();

  const details: Record<string, string> = {
    product,
    vehicle: `${params.vehicle.color} vehicle · ${params.vehicle.year}`.trim(),
    plate: params.vehicle.regNo,
    makeCode: params.vehicle.makeCode,
    modelCode: params.vehicle.modelCode,
    color: params.vehicle.color,
    engineNo: params.vehicle.engineNo,
    chassisNo: params.vehicle.chassisNo,
    year: params.vehicle.year,
    vehicleType: params.vehicle.vehicleTypeName,
    usage: params.vehicle.usage,
    ...(params.variant ? { variant: params.variant } : {}),
    ...(params.vehicleValue ? { vehicleValue: String(params.vehicleValue) } : {}),
    ...(params.excessBuyBack !== undefined ? { excessBuyBack: params.excessBuyBack ? "yes" : "no" } : {}),
    ...(params.inspection
      ? {
          inspectionAddress: params.inspection.address,
          inspectionDate: params.inspection.date,
          inspectionContact: params.inspection.person,
        }
      : {}),
  };

  // Phase 1 — reserve funds and create the pending policy.
  const { reference, orderId } = await db.transaction(async (tx) => {
    const reference = await newOrderReference(tx);
    const orderId = randomUUID();
    const now = new Date();
    await tx.insert(order).values({
      id: orderId,
      reference,
      userId: params.userId,
      kind: "insurance",
      total: pricing.total,
      stage: "pending",
      createdAt: now,
      paidAt: now,
    });
    await tx.insert(insurancePolicy).values({
      orderId,
      planId: plan.id,
      underwriter,
      policyNo: null,
      periodStart,
      periodEnd,
      termMonths,
      sumInsured: params.vehicleValue ?? null,
      basePremium: pricing.basePremium,
      stampDuty: pricing.stampDuty,
      vat: pricing.vat,
      insuredParty,
      details,
      certificateUrl: null,
      boundAt: null,
    });
    await applyWalletMovement(tx, {
      userId: params.userId,
      amount: -pricing.total,
      type: "insurance",
      description: `${plan.name ?? "Motor policy"} — NEM · ${params.vehicle.regNo}`,
      orderId,
    });
    return { reference, orderId };
  });

  // Phase 2 — issue with NEM. Unique per attempt so a retry is never a duplicate.
  const creditNoteNo = `MCS-${reference}-${Date.now().toString(36).toUpperCase()}`;
  const common = { customer: params.customer, vehicle: params.vehicle, startDate: params.startDate, creditNoteNo };
  const request: NemPurchase =
    product === "mtp"
      ? { product, ...common }
      : product === "emtp"
        ? { product, ...common, variant: params.variant!, premium, inspection: params.inspection! }
        : { product, ...common, vehicleValue: params.vehicleValue!, excessBuyBack: !!params.excessBuyBack, inspection: params.inspection! };
  const payloadForLog = redactPayload(buildPurchasePayload(request));

  let result;
  try {
    result = await nemPurchase(request);
  } catch (err) {
    const code = err instanceof NemApiError ? err.code : 0;
    const message =
      err instanceof NemApiError
        ? describeNemError(err.code, err.message)
        : err instanceof NemNetworkError
          ? err.message
          : "Unexpected error talking to NEM.";
    await db.transaction(async (tx) => {
      await tx.update(order).set({ stage: "failed" }).where(eq(order.id, orderId));
      await applyWalletMovement(tx, {
        userId: params.userId,
        amount: pricing.total,
        type: "refund",
        description: `Refund · ${reference} · underwriter declined`,
        orderId,
      });
      await tx.insert(underwriterTransaction).values({
        id: randomUUID(),
        orderId,
        provider: "nem",
        endpoint: NEM_ENDPOINT[product],
        creditNoteNo,
        status: "failed",
        respCode: code || null,
        message,
        request: payloadForLog,
        response: err instanceof NemApiError ? (err.raw as Record<string, unknown> | undefined) ?? null : null,
      });
    });
    throw new UnderwriterError(code, message, reference);
  }

  const boundAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(insurancePolicy)
      .set({
        policyNo: result.policyNo,
        providerRef: result.transRef || null,
        naicomId: result.naicomId,
        certificateUrl: result.certificateUrl ?? `/insurance/certificate/${reference}`,
        debitNoteUrl: result.debitNoteUrl,
        creditNoteUrl: result.creditNoteUrl,
        boundAt,
      })
      .where(eq(insurancePolicy.orderId, orderId));
    await tx.update(order).set({ stage: "active" }).where(eq(order.id, orderId));
    await tx.insert(underwriterTransaction).values({
      id: randomUUID(),
      orderId,
      provider: "nem",
      endpoint: NEM_ENDPOINT[product],
      creditNoteNo,
      status: "success",
      respCode: 200,
      message: String(result.raw.response ?? "success"),
      request: payloadForLog,
      response: result.raw,
    });
  });

  const [w] = await db
    .select({ balance: wallet.balance })
    .from(wallet)
    .where(eq(wallet.userId, params.userId))
    .limit(1);

  return {
    reference,
    policyNo: result.policyNo,
    total: pricing.total,
    balanceAfter: w?.balance ?? 0,
    providerRef: result.transRef,
    certificateUrl: result.certificateUrl,
  };
}
