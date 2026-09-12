import "server-only";
import { and, eq, asc } from "drizzle-orm";
import { db } from "./db";
import { insurancePlan } from "./schema";
import { type InsurancePlan, type AdminInsurancePlan } from "./mock-data";
import { requireStaff } from "./server-session";

/* ───────────────────────── 02 · Insurance plans ───────────────────────── */

export function insuranceCategory(v: unknown): InsurancePlan["category"] {
  if (v === "Property" || v === "Goods" || v === "Health") return v;
  return "Motor";
}

function productCode(v: unknown): InsurancePlan["productCode"] | null {
  return v === "mtp" || v === "comp" || v === "emtp" ? v : null;
}

/**
 * A row is only sellable if a real underwriter integration stands behind it.
 * Anything else (a legacy row, a half-configured plan) is skipped rather than
 * shown, so a customer can never be quoted cover nobody will issue.
 */
function toPlan(r: typeof insurancePlan.$inferSelect): InsurancePlan | null {
  const code = productCode(r.productCode);
  if (r.provider !== "nem" || !code) return null;
  const plan: InsurancePlan = {
    id: r.reference,
    name: r.name ?? "",
    underwriter: r.underwriter ?? "",
    premium: r.premium ?? 0,
    term: r.term ?? "per 12 months",
    category: insuranceCategory(r.category),
    features: r.features ?? [],
    provider: "nem",
    productCode: code,
  };
  if (r.popular) plan.popular = true;
  return plan;
}

/** Drop unsellable rows. */
function sellable(rows: (typeof insurancePlan.$inferSelect)[]): InsurancePlan[] {
  return rows.map(toPlan).filter((p): p is InsurancePlan => p !== null);
}

/** One active plan by reference, or undefined. */
export async function getInsurancePlan(reference: string): Promise<InsurancePlan | undefined> {
  const rows = await db
    .select()
    .from(insurancePlan)
    .where(and(eq(insurancePlan.reference, reference), eq(insurancePlan.active, true)))
    .limit(1);
  return rows[0] ? toPlan(rows[0]) ?? undefined : undefined;
}

/** All active insurance plans (catalogue is global, not customer-scoped). */
export async function getInsurancePlans(): Promise<InsurancePlan[]> {
  const rows = await db
    .select()
    .from(insurancePlan)
    .where(eq(insurancePlan.active, true))
    .orderBy(asc(insurancePlan.reference));
  return sellable(rows);
}

/** Admin catalogue: every plan incl. hidden ones, with management fields. */
export async function getAdminInsurancePlans(): Promise<AdminInsurancePlan[]> {
  await requireStaff();
  const rows = await db.select().from(insurancePlan).orderBy(asc(insurancePlan.reference));
  // Admins see every row, including any that isn't sellable, so they can fix it.
  return rows.flatMap((r) => {
    const plan = toPlan(r);
    return plan ? [{ ...plan, active: r.active ?? false }] : [];
  });
}

/** Headline figures for the customer browse page. */
export async function getInsuranceMeta(): Promise<{ underwriters: number; blurb: string }> {
  const plans = await getInsurancePlans();
  const underwriters = new Set(plans.map((p) => p.underwriter)).size;
  return {
    underwriters,
    blurb:
      "Compare quotes from licensed underwriters and bind a policy without leaving the wallet.",
  };
}
