"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { insurancePlan } from "@/lib/schema";
import { requirePermission } from "@/lib/server-session";

export type PlanResult = { ok: boolean; message: string } | null;

const CATEGORIES = ["Motor", "Property", "Goods", "Health"] as const;
const PRODUCTS = ["mtp", "comp", "emtp"] as const;

/** Only underwriter-backed plans exist; the field is kept for future insurers. */
function toProvider(): "nem" {
  return "nem";
}

function toProductCode(v: FormDataEntryValue | null): (typeof PRODUCTS)[number] | null {
  const s = String(v ?? "");
  return (PRODUCTS as readonly string[]).includes(s) ? (s as (typeof PRODUCTS)[number]) : null;
}

function toInt(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").replace(/[,\s₦]/g, ""));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function toCategory(v: FormDataEntryValue | null): (typeof CATEGORIES)[number] {
  const s = String(v ?? "");
  return (CATEGORIES as readonly string[]).includes(s) ? (s as (typeof CATEGORIES)[number]) : "Motor";
}

/** "Theft, Third party, Fire & flood" → ["Theft", "Third party", "Fire & flood"] */
function toFeatures(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function revalidateCatalog() {
  revalidatePath("/admin/insurance");
  revalidatePath("/insurance");
}

/** Update premium / underwriter / class / features / visibility for one plan. */
export async function updateInsurancePlan(
  _prev: PlanResult,
  formData: FormData,
): Promise<PlanResult> {
  await requirePermission({ product: ["manage"] });

  const reference = String(formData.get("reference") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const underwriter = String(formData.get("underwriter") ?? "").trim();
  const premium = toInt(formData.get("premium"));
  const category = toCategory(formData.get("category"));
  const features = toFeatures(formData.get("features"));
  const popular = formData.get("popular") === "on";
  const active = formData.get("active") === "on";
  const provider = toProvider();
  const productCode = toProductCode(formData.get("productCode"));

  if (!name) return { ok: false, message: "Enter the plan name." };
  if (!underwriter) return { ok: false, message: "Enter the underwriter." };
  if (!productCode) return { ok: false, message: "Choose the NEM product this plan maps to — McSond doesn't underwrite its own cover." };
  if (category !== "Motor") return { ok: false, message: "NEM products are motor cover — set the class to Motor." };

  const updated = await db
    .update(insurancePlan)
    .set({
      name,
      underwriter,
      premium: premium ?? 0,
      category,
      features,
      popular,
      active,
      provider,
      productCode,
      updatedAt: new Date(),
    })
    .where(eq(insurancePlan.reference, reference))
    .returning({ id: insurancePlan.id });
  if (!updated[0]) return { ok: false, message: "Plan not found." };

  revalidateCatalog();
  return { ok: true, message: "Saved." };
}

/** Add a new plan to the catalogue. */
export async function createInsurancePlan(
  _prev: PlanResult,
  formData: FormData,
): Promise<PlanResult> {
  await requirePermission({ product: ["manage"] });

  const name = String(formData.get("name") ?? "").trim();
  const underwriter = String(formData.get("underwriter") ?? "").trim();
  const premium = toInt(formData.get("premium"));
  const category = toCategory(formData.get("category"));
  const features = toFeatures(formData.get("features"));
  const provider = toProvider();
  const productCode = toProductCode(formData.get("productCode"));

  if (!name) return { ok: false, message: "Enter the plan name." };
  if (!underwriter) return { ok: false, message: "Enter the underwriter." };
  if (!productCode) return { ok: false, message: "Choose the NEM product this plan maps to — McSond doesn't underwrite its own cover." };
  if (category !== "Motor") return { ok: false, message: "NEM products are motor cover — set the class to Motor." };

  const reference = `${name}-${underwriter.split(" ")[0]}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const existing = await db
    .select({ id: insurancePlan.id })
    .from(insurancePlan)
    .where(eq(insurancePlan.reference, reference))
    .limit(1);
  if (existing[0]) return { ok: false, message: `"${name}" by ${underwriter} already exists in the catalogue.` };

  await db.insert(insurancePlan).values({
    id: randomUUID(),
    reference,
    name,
    underwriter,
    premium: premium ?? 0,
    term: productCode === "comp" ? "5% of vehicle value" : "per 12 months",
    category,
    features,
    popular: false,
    active: true,
    provider,
    productCode,
  });

  revalidateCatalog();
  return { ok: true, message: `${name} added to the catalogue.` };
}
