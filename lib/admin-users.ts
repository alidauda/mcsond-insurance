import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { user } from "./auth-schema";
import { kycProfile } from "./schema";
import type { KycStatus } from "./mock-data";
import type { UserRow } from "@/components/admin/UsersTable";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function kycOf(v: unknown): KycStatus {
  return v === "verified" || v === "pending" ? v : "unverified";
}

function isoDate(d: unknown): string {
  return new Date(d as string).toISOString().slice(0, 10);
}

/** Customer list for /admin/users via the permission-checked admin API. */
export async function listCustomers(): Promise<UserRow[]> {
  const res = await auth.api.listUsers({
    headers: await headers(),
    query: { limit: 200, sortBy: "createdAt", sortDirection: "desc" },
  });
  // additionalFields (company, kyc) aren't in the inferred row type.
  const users = res.users as (typeof res.users[number] & { company?: string | null; kyc?: string | null })[];
  return users
    .filter((u) => (u.role ?? "user") === "user")
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      initials: initials(u.name),
      company: u.company ?? "—",
      kyc: kycOf(u.kyc),
      banned: !!u.banned,
      createdAt: isoDate(u.createdAt),
    }));
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  initials: string;
  company: string;
  role: string;
  kyc: KycStatus;
  banned: boolean;
  createdAt: string;
}

/** Single-user lookup for the detail page (request-time). */
export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const rows = await db.select().from(user).where(eq(user.id, id)).limit(1);
  const u = rows[0];
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    initials: initials(u.name),
    company: u.company ?? "—",
    role: u.role ?? "user",
    kyc: kycOf(u.kyc),
    banned: !!u.banned,
    createdAt: isoDate(u.createdAt),
  };
}

export interface KycRecord {
  bvnMasked: string;
  bvnVerified: boolean;
  utilityBill: boolean;
  idCard: boolean;
  reviewedBy: string;
  reviewedAt: string;
}

/** KYC evidence on file for a customer (null when nothing has been submitted). */
export async function getKycRecord(userId: string): Promise<KycRecord | null> {
  const rows = await db
    .select({
      bvnMasked: kycProfile.bvnMasked,
      bvnVerified: kycProfile.bvnVerified,
      utilityBill: kycProfile.utilityBill,
      idCard: kycProfile.idCard,
      reviewedAt: kycProfile.reviewedAt,
      reviewerName: user.name,
    })
    .from(kycProfile)
    .leftJoin(user, eq(user.id, kycProfile.reviewedBy))
    .where(eq(kycProfile.userId, userId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    bvnMasked: r.bvnMasked ?? "—",
    bvnVerified: !!r.bvnVerified,
    utilityBill: !!r.utilityBill,
    idCard: !!r.idCard,
    reviewedBy: r.reviewerName ?? "—",
    reviewedAt: r.reviewedAt ? isoDate(r.reviewedAt) : "pending",
  };
}
