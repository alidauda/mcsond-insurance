"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kycProfile } from "@/lib/schema";
import { runKycVerification, type KycResult } from "@/lib/kyc";
import { requirePermission } from "@/lib/server-session";
import type { Role } from "@/lib/permissions";

// Every action re-checks permission server-side (UI gating is not enough, and
// layouts don't re-run on client navigation). Each maps to a matrix capability.

export async function suspendUser(userId: string, reason?: string) {
  await requirePermission({ user: ["ban"] });
  await auth.api.banUser({
    headers: await headers(),
    body: { userId, banReason: reason || "Suspended by staff" },
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function reactivateUser(userId: string) {
  await requirePermission({ user: ["ban"] });
  await auth.api.unbanUser({ headers: await headers(), body: { userId } });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function setUserRole(userId: string, role: Role) {
  await requirePermission({ user: ["set-role"] });
  await auth.api.setRole({
    headers: await headers(),
    body: { userId, role },
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/staff");
}

/**
 * Set a customer's KYC status (user:kyc). Approving also stamps the reviewer
 * on the kyc_profile row so the evidence trail shows who signed it off.
 */
export async function setUserKyc(userId: string, kyc: "verified" | "pending" | "unverified") {
  const reviewer = await requirePermission({ user: ["kyc"] });
  await auth.api.adminUpdateUser({
    headers: await headers(),
    body: { userId, data: { kyc } },
  });
  const reviewedAt = kyc === "verified" ? new Date() : null;
  await db
    .insert(kycProfile)
    .values({ userId, reviewedBy: reviewer.id, reviewedAt })
    .onConflictDoUpdate({
      target: kycProfile.userId,
      set: { reviewedBy: reviewer.id, reviewedAt },
    });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function revokeAllSessions(userId: string) {
  await requirePermission({ user: ["ban"] });
  await auth.api.revokeUserSessions({ headers: await headers(), body: { userId } });
  revalidatePath(`/admin/users/${userId}`);
}

export async function impersonate(userId: string) {
  await requirePermission({ user: ["impersonate"] });
  await auth.api.impersonateUser({ headers: await headers(), body: { userId } });
  // Now acting as the customer — go to their portal.
  redirect("/dashboard");
}

export type KycReviewState = { ok: boolean; message: string } | null;

/**
 * Settle a KYC case that the automatic name match left pending. Approving
 * stamps the reviewer on the profile; rejecting clears the identity evidence
 * so the customer must run a fresh check.
 */
export async function decideKycReview(userId: string, decision: "approve" | "reject"): Promise<KycReviewState> {
  const reviewer = await requirePermission({ user: ["kyc"] });
  const now = new Date();
  const approved = decision === "approve";

  await auth.api.adminUpdateUser({
    headers: await headers(),
    body: { userId, data: { kyc: approved ? "verified" : "unverified" } },
  });
  await db
    .update(kycProfile)
    .set({
      ninVerified: approved,
      verifiedAt: approved ? now : null,
      reviewedBy: reviewer.id,
      reviewedAt: now,
      // A rejected record isn't this customer's — drop the biometric data.
      ...(approved ? {} : { photoData: null, photoOnFile: false }),
    })
    .where(eq(kycProfile.userId, userId));

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {
    ok: true,
    message: approved ? "KYC approved — the customer can now bind cover." : "KYC rejected — the customer must verify again.",
  };
}

/** Run an identity check on a customer's behalf (phone-desk / branch flow). */
export async function runKycForUser(
  _prev: (KycResult & { ok: boolean }) | null,
  formData: FormData,
): Promise<(KycResult & { ok: boolean }) | null> {
  const reviewer = await requirePermission({ user: ["kyc"] });

  const userId = String(formData.get("userId") ?? "");
  const method = String(formData.get("method") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  if (!userId) return { ok: false, outcome: "failed", message: "Missing customer.", nameMatchScore: null };

  let input;
  if (method === "nin") {
    if (!/^\d{11}$/.test(value)) return { ok: false, outcome: "failed", message: "NIN must be 11 digits.", nameMatchScore: null };
    input = { method: "nin" as const, nin: value };
  } else if (method === "phone") {
    if (!/^0\d{10}$/.test(value)) return { ok: false, outcome: "failed", message: "Phone must be 11 digits starting with 0.", nameMatchScore: null };
    input = { method: "phone" as const, phone: value };
  } else if (method === "shareCode") {
    if (value.length < 4) return { ok: false, outcome: "failed", message: "Enter the share code.", nameMatchScore: null };
    input = { method: "shareCode" as const, shareCode: value.toUpperCase() };
  } else {
    return { ok: false, outcome: "failed", message: "Choose a verification method.", nameMatchScore: null };
  }

  const result = await runKycVerification({ userId, input, actorId: reviewer.id });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { ...result, ok: result.outcome !== "failed" };
}
