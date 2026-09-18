import "server-only";
import { randomUUID, createHmac } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "./db";
import { kycProfile, kycVerification, auditEntry } from "./schema";
import { user } from "./auth-schema";
import { sendKycOutcomeEmail, sendIdentityReuseAlertEmail } from "./email";
import {
  verifyByNin,
  verifyByPhone,
  verifyByShareCode,
  searchByDemography,
  maskNin,
  redactRequest,
  redactIdentity,
  describeSwiftCheckError,
  markMethodUnavailable,
  SwiftCheckApiError,
  KYC_METHOD_LABEL,
  type KycMethod,
  type VerifiedIdentity,
} from "./swiftcheck";
import type { KycStatus } from "./mock-data";

/**
 * KYC domain logic: run an identity check, decide whether it clears, and
 * persist the evidence.
 *
 * A check never silently grants verification. The name on the government
 * record is compared with the name on the account:
 *   ≥ AUTO_VERIFY_SCORE  → verified automatically
 *   ≥ REVIEW_SCORE       → pending, queued for a KYC reviewer
 *   below that           → failed; the customer is told the names don't match
 */

/** Name-similarity thresholds (0-100). */
export const AUTO_VERIFY_SCORE = 85;
export const REVIEW_SCORE = 55;

export type KycOutcome = "verified" | "review" | "failed";

export type KycResult = {
  outcome: KycOutcome;
  /** Customer-facing explanation. Never contains provider internals. */
  message: string;
  nameMatchScore: number | null;
  /** Only set when the check reached the provider and returned an identity. */
  identity?: {
    fullName: string;
    dateOfBirth: string | null;
    ninMasked: string | null;
  };
};

/* ───────────────────────── name matching ───────────────────────── */

/** Strip titles, punctuation and case so two names can be compared fairly. */
function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\b(mr|mrs|miss|ms|dr|chief|alhaji|alhaja|engr|barr|prof)\b\.?/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Levenshtein ratio (0-1) — tolerates the odd typo or transliteration. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...new Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

/**
 * Score how well two names match, 0-100. Order-insensitive (Nigerian records
 * often put the surname first) and forgiving of a missing middle name: every
 * token of the shorter name must find a partner in the longer one.
 */
export function scoreNameMatch(accountName: string, verifiedName: string): number {
  const a = nameTokens(accountName);
  const b = nameTokens(verifiedName);
  if (!a.length || !b.length) return 0;

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const pool = [...longer];
  let total = 0;
  for (const token of shorter) {
    let bestIdx = -1;
    let best = 0;
    pool.forEach((candidate, i) => {
      const s = similarity(token, candidate);
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) pool.splice(bestIdx, 1);
    total += best;
  }
  return Math.round((total / shorter.length) * 100);
}

/* ───────────────────────── one account per identity ───────────────────────── */

const DUPLICATE_IDENTITY_MESSAGE =
  "This identity is already verified on another McSond Insurance account. If that account is yours, sign in with it instead. If you think someone else used your details, contact support.";

let warnedNoHashKey = false;

/**
 * Stable, keyed fingerprint of a verified identity. HMAC-SHA256 under a server
 * secret, so the stored value can be compared for equality but never reversed
 * to a NIN. Prefer the NIN; fall back to the provider's pseudo-id, then to
 * name + DOB + gender (weaker, but still catches the obvious repeat).
 * Returns null only when no key is configured — then the check is skipped.
 */
export function identityFingerprint(identity: Pick<VerifiedIdentity, "nin" | "pseudoId" | "fullName" | "dateOfBirth" | "gender">): string | null {
  const key = process.env.KYC_HASH_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!key) {
    if (!warnedNoHashKey) {
      warnedNoHashKey = true;
      console.warn("[kyc] KYC_HASH_SECRET / BETTER_AUTH_SECRET not set — duplicate-identity protection is off.");
    }
    return null;
  }
  const nin = identity.nin?.replace(/\D/g, "");
  let material: string;
  if (nin && nin.length >= 10) material = `nin:${nin}`;
  else if (identity.pseudoId) material = `pid:${identity.pseudoId}`;
  else if (identity.fullName && identity.dateOfBirth) {
    material = `demo:${nameTokens(identity.fullName).sort().join(" ")}|${identity.dateOfBirth}|${(identity.gender ?? "").toLowerCase()}`;
  } else return null;
  return createHmac("sha256", key).update(material).digest("hex");
}

/** Another account (verified or awaiting review) already holds this identity? */
async function findIdentityOwner(fingerprint: string, exceptUserId: string) {
  const rows = await db
    .select({ userId: kycProfile.userId, email: user.email, name: user.name, kyc: user.kyc })
    .from(kycProfile)
    .innerJoin(user, eq(user.id, kycProfile.userId))
    .where(
      and(
        eq(kycProfile.identityHash, fingerprint),
        ne(kycProfile.userId, exceptUserId),
        inArray(user.kyc, ["verified", "pending"]),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Postgres unique-violation on the identity index (two checks raced). */
function isIdentityHashCollision(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.cause?.code;
  const constraint = e?.constraint ?? e?.cause?.constraint;
  return code === "23505" && constraint === "kyc_profile_identity_hash_unique";
}

/* ───────────────────────── running a check ───────────────────────── */

export type KycInput =
  | { method: "nin"; nin: string }
  | { method: "phone"; phone: string }
  | { method: "shareCode"; shareCode: string }
  | { method: "demography"; firstName: string; lastName: string; dateOfBirth: string; gender: "m" | "f" };

function requestBodyFor(input: KycInput): Record<string, unknown> {
  switch (input.method) {
    case "nin":
      return { nin: input.nin };
    case "phone":
      return { phone: input.phone };
    case "shareCode":
      return { shareCode: input.shareCode };
    case "demography":
      return {
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
      };
  }
}

async function lookup(input: KycInput): Promise<VerifiedIdentity> {
  switch (input.method) {
    case "nin":
      return verifyByNin(input.nin);
    case "phone":
      return verifyByPhone(input.phone);
    case "shareCode":
      return verifyByShareCode(input.shareCode);
    case "demography":
      return searchByDemography(input);
  }
}

/** Log an attempt. Request/response are already redacted by the caller. */
async function logAttempt(row: {
  userId: string;
  method: KycMethod;
  outcome: KycOutcome;
  code: string | null;
  message: string;
  nameMatchScore: number | null;
  requestId: string | null;
  consentId: string | null;
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
  actorId: string | null;
}) {
  await db.insert(kycVerification).values({
    id: randomUUID(),
    userId: row.userId,
    provider: "swiftcheck",
    method: row.method,
    outcome: row.outcome,
    code: row.code,
    message: row.message,
    nameMatchScore: row.nameMatchScore,
    providerRequestId: row.requestId,
    providerConsentId: row.consentId,
    request: row.request,
    response: row.response,
    actorId: row.actorId,
  });
}

/**
 * Run an identity check for a customer and record the result.
 *
 * `actorId` is the staff member when a reviewer runs the check on someone's
 * behalf; null when the customer runs it themselves.
 */
export async function runKycVerification(params: {
  userId: string;
  input: KycInput;
  actorId?: string | null;
}): Promise<KycResult> {
  const { userId, input } = params;
  const actorId = params.actorId ?? null;
  const method = input.method;
  const redactedRequest = redactRequest(requestBodyFor(input));

  const [account] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!account) throw new Error("USER_NOT_FOUND");

  let identity: VerifiedIdentity;
  try {
    identity = await lookup(input);
  } catch (err) {
    // A 403 means the business isn't entitled to this method — stop offering it.
    if (err instanceof SwiftCheckApiError && err.isNotEntitled) markMethodUnavailable(method);
    const message = describeSwiftCheckError(err);
    await logAttempt({
      userId,
      method,
      outcome: "failed",
      code: err instanceof SwiftCheckApiError ? err.code : "network",
      message,
      nameMatchScore: null,
      requestId: null,
      consentId: null,
      request: redactedRequest,
      response: null,
      actorId,
    });
    return { outcome: "failed", message, nameMatchScore: null };
  }

  // One identity, one account. Checked before the name match: whose record it
  // is matters more than how well the name lines up.
  const fingerprint = identityFingerprint(identity);
  const owner = fingerprint ? await findIdentityOwner(fingerprint, userId) : null;
  if (owner) return blockDuplicate({ userId, account, owner, method, redactedRequest, identity, actorId });

  const score = scoreNameMatch(account.name, identity.fullName);
  const outcome: KycOutcome =
    score >= AUTO_VERIFY_SCORE ? "verified" : score >= REVIEW_SCORE ? "review" : "failed";
  const message =
    outcome === "verified"
      ? "Identity verified — your account is now fully activated."
      : outcome === "review"
        ? "We found your record, but the name doesn't match your account closely enough to clear automatically. A reviewer will check it shortly."
        : `The name on that record (${identity.fullName}) doesn't match the name on this account. Update your account name or use your own identity details.`;

  const now = new Date();
  const redactedResponse = redactIdentity(identity);

  try {
  await db.transaction(async (tx) => {
    // Only a clean match writes identity evidence to the profile; a mismatch
    // is recorded in the attempt log only.
    if (outcome !== "failed") {
      const profileValues = {
        ninMethod: method,
        ninMasked: maskNin(identity.nin),
        ninVerified: outcome === "verified",
        verifiedName: identity.fullName,
        verifiedDob: identity.dateOfBirth,
        verifiedGender: identity.gender,
        verifiedPhone: identity.phone,
        verifiedState: identity.birthState,
        photoOnFile: identity.hasPhoto,
        photoData: identity.photoBase64,
        nameMatchScore: score,
        providerRequestId: identity.requestId,
        providerConsentId: identity.consentId,
        identityHash: fingerprint,
        verifiedAt: outcome === "verified" ? now : null,
        // An automatic pass has no human reviewer.
        reviewedBy: null,
        reviewedAt: outcome === "verified" ? now : null,
      };
      await tx
        .insert(kycProfile)
        .values({ userId, ...profileValues })
        .onConflictDoUpdate({ target: kycProfile.userId, set: profileValues });
    }

    const status: KycStatus = outcome === "verified" ? "verified" : outcome === "review" ? "pending" : "unverified";
    await tx.update(user).set({ kyc: status, updatedAt: now }).where(eq(user.id, userId));

    await tx.insert(auditEntry).values({
      id: randomUUID(),
      actorId,
      actorName: actorId ? "Staff" : account.name,
      action: outcome === "verified" ? "KYC verified" : outcome === "review" ? "KYC pending review" : "KYC check failed",
      actionTone: outcome === "failed" ? "danger" : "neutral",
      targetType: "user",
      targetRef: account.email,
      detail: `${KYC_METHOD_LABEL[method]} check · name match ${score}%`,
      createdAt: now,
    });
  });
  } catch (err) {
    // Two accounts verified the same identity at the same instant; the unique
    // index caught what the pre-check couldn't. Same verdict as the pre-check.
    if (isIdentityHashCollision(err) && fingerprint) {
      const racedOwner = await findIdentityOwner(fingerprint, userId);
      if (racedOwner) return blockDuplicate({ userId, account, owner: racedOwner, method, redactedRequest, identity, actorId });
    }
    throw err;
  }

  await logAttempt({
    userId,
    method,
    outcome,
    code: "200",
    message,
    nameMatchScore: score,
    requestId: identity.requestId,
    consentId: identity.consentId,
    request: redactedRequest,
    response: redactedResponse,
    actorId,
  });

  // Tell the customer the verdict. Fire-and-forget: mail must never hold up
  // or fail the check (a provider error above is not a verdict, so no mail).
  void sendKycOutcomeEmail({ to: account.email, name: account.name, outcome });

  return {
    outcome,
    message,
    nameMatchScore: score,
    identity: {
      fullName: identity.fullName,
      dateOfBirth: identity.dateOfBirth,
      ninMasked: maskNin(identity.nin),
    },
  };
}

/**
 * Refuse a check because the identity already belongs to another account:
 * log it, leave an audit trail naming both accounts (staff-only), tell the
 * customer without revealing whose it is, and warn the real owner.
 */
async function blockDuplicate(p: {
  userId: string;
  account: { email: string; name: string };
  owner: { userId: string; email: string; name: string };
  method: KycMethod;
  redactedRequest: Record<string, unknown>;
  identity: VerifiedIdentity;
  actorId: string | null;
}): Promise<KycResult> {
  await Promise.all([
    logAttempt({
      userId: p.userId,
      method: p.method,
      outcome: "failed",
      code: "duplicate-identity",
      message: DUPLICATE_IDENTITY_MESSAGE,
      nameMatchScore: null,
      requestId: p.identity.requestId,
      consentId: p.identity.consentId,
      request: p.redactedRequest,
      response: { ninMasked: maskNin(p.identity.nin), alreadyLinkedTo: p.owner.userId },
      actorId: p.actorId,
    }),
    db.insert(auditEntry).values({
      id: randomUUID(),
      actorId: p.actorId,
      actorName: p.actorId ? "Staff" : p.account.name,
      action: "KYC blocked · identity already linked",
      actionTone: "danger",
      targetType: "user",
      targetRef: p.account.email,
      detail: `${KYC_METHOD_LABEL[p.method]} check returned an identity (NIN ${maskNin(p.identity.nin) ?? "n/a"}) already held by ${p.owner.email}`,
      createdAt: new Date(),
    }),
  ]);
  void sendKycOutcomeEmail({ to: p.account.email, name: p.account.name, outcome: "duplicate" });
  void sendIdentityReuseAlertEmail({ to: p.owner.email, name: p.owner.name });
  return { outcome: "failed", message: DUPLICATE_IDENTITY_MESSAGE, nameMatchScore: null };
}

/* ───────────────────────── reads ───────────────────────── */

export type KycEvidence = {
  status: KycStatus;
  method: KycMethod | null;
  methodLabel: string | null;
  ninMasked: string | null;
  verifiedName: string | null;
  verifiedDob: string | null;
  verifiedGender: string | null;
  verifiedPhone: string | null;
  verifiedState: string | null;
  photoOnFile: boolean;
  nameMatchScore: number | null;
  requestId: string | null;
  consentId: string | null;
  verifiedAt: string | null;
  reviewedBy: string | null;
  // legacy document flags
  bvnMasked: string | null;
  utilityBill: boolean;
  idCard: boolean;
};

function isMethod(v: unknown): v is KycMethod {
  return v === "nin" || v === "phone" || v === "shareCode" || v === "demography";
}

/** Full KYC evidence for a customer, or null when nothing has been submitted. */
export async function getKycEvidence(userId: string): Promise<KycEvidence | null> {
  const rows = await db
    .select({
      p: kycProfile,
      accountKyc: user.kyc,
      reviewerName: user.name,
    })
    .from(kycProfile)
    .leftJoin(user, eq(user.id, kycProfile.reviewedBy))
    .where(eq(kycProfile.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const p = row.p;

  const [account] = await db.select({ kyc: user.kyc }).from(user).where(eq(user.id, userId)).limit(1);
  const status: KycStatus =
    account?.kyc === "verified" || account?.kyc === "pending" ? account.kyc : "unverified";

  return {
    status,
    method: isMethod(p.ninMethod) ? p.ninMethod : null,
    methodLabel: isMethod(p.ninMethod) ? KYC_METHOD_LABEL[p.ninMethod] : null,
    ninMasked: p.ninMasked,
    verifiedName: p.verifiedName,
    verifiedDob: p.verifiedDob,
    verifiedGender: p.verifiedGender,
    verifiedPhone: p.verifiedPhone,
    verifiedState: p.verifiedState,
    photoOnFile: !!p.photoOnFile,
    nameMatchScore: p.nameMatchScore,
    requestId: p.providerRequestId,
    consentId: p.providerConsentId,
    verifiedAt: p.verifiedAt ? new Date(p.verifiedAt).toISOString().slice(0, 16).replace("T", " ") : null,
    reviewedBy: row.reviewerName ?? null,
    bvnMasked: p.bvnMasked,
    utilityBill: !!p.utilityBill,
    idCard: !!p.idCard,
  };
}

export type KycAttempt = {
  id: string;
  method: string;
  methodLabel: string;
  outcome: string;
  message: string | null;
  nameMatchScore: number | null;
  requestId: string | null;
  at: string;
};

/** Recent identity-check attempts for a customer, newest first. */
export async function getKycAttempts(userId: string, limit = 10): Promise<KycAttempt[]> {
  const rows = await db
    .select()
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .orderBy(desc(kycVerification.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    method: r.method,
    methodLabel: isMethod(r.method) ? KYC_METHOD_LABEL[r.method] : r.method,
    outcome: r.outcome,
    message: r.message,
    nameMatchScore: r.nameMatchScore,
    requestId: r.providerRequestId,
    at: new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " "),
  }));
}

/** The signed-in customer's own KYC status (cheap read for gating). */
export async function getKycStatus(userId: string): Promise<KycStatus> {
  const [row] = await db.select({ kyc: user.kyc }).from(user).where(eq(user.id, userId)).limit(1);
  return row?.kyc === "verified" || row?.kyc === "pending" ? row.kyc : "unverified";
}

/* ───────────────────────── reviewer-only reads ───────────────────────── */

/**
 * The NIMC face photograph for a customer, as a data URL.
 *
 * Biometric PII: this is gated on `user:kyc`, so only a KYC reviewer (or a
 * superadmin) can load it. It is never included in `getKycEvidence`, so it
 * cannot leak into the customer-facing pages.
 */
export async function getKycPhoto(userId: string): Promise<string | null> {
  const { requirePermission } = await import("./server-session");
  await requirePermission({ user: ["kyc"] });
  const [row] = await db
    .select({ photo: kycProfile.photoData })
    .from(kycProfile)
    .where(eq(kycProfile.userId, userId))
    .limit(1);
  if (!row?.photo) return null;
  const raw = row.photo.trim();
  return raw.startsWith("data:") ? raw : `data:image/jpeg;base64,${raw}`;
}

/** True when the acting staff member may view biometric data. */
export async function canViewKycPhoto(): Promise<boolean> {
  try {
    const { requirePermission } = await import("./server-session");
    await requirePermission({ user: ["kyc"] });
    return true;
  } catch {
    return false;
  }
}

export type AttemptIdentity = {
  fullName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  birthState: string | null;
  phone: string | null;
  ninMasked: string | null;
  outcome: string;
  method: string;
  methodLabel: string;
  nameMatchScore: number | null;
  at: string;
};

/**
 * The identity returned by the most recent check, from the redacted attempt
 * log. Used for the reviewer's side-by-side comparison, which must work even
 * when the match failed and no profile row was written.
 */
export async function getLatestAttemptIdentity(userId: string): Promise<AttemptIdentity | null> {
  const [row] = await db
    .select()
    .from(kycVerification)
    .where(eq(kycVerification.userId, userId))
    .orderBy(desc(kycVerification.createdAt))
    .limit(1);
  if (!row) return null;
  const r = (row.response ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    fullName: str(r.fullName),
    dateOfBirth: str(r.dateOfBirth),
    gender: str(r.gender),
    birthState: str(r.birthState),
    phone: str(r.phone),
    ninMasked: str(r.ninMasked),
    outcome: row.outcome,
    method: row.method,
    methodLabel: isMethod(row.method) ? KYC_METHOD_LABEL[row.method] : row.method,
    nameMatchScore: row.nameMatchScore,
    at: new Date(row.createdAt).toISOString().slice(0, 16).replace("T", " "),
  };
}
