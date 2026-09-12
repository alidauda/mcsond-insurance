import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { schema, staffInvite } from "./auth-schema";
import { ac, roles, STAFF_ROLES, type Role } from "./permissions";
import { sendAuthEmail, isEmailConfigured } from "./email";

const STAFF_DOMAIN = (process.env.STAFF_DOMAIN ?? "mcsond.ng").toLowerCase();

const SUPERADMIN_EMAILS = new Set(
  (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

// Static email -> role map for the known internal team. New @STAFF_DOMAIN
// addresses not listed here default to "support" (see roleForEmail); change a
// member's role later from /admin/staff. Keep auth decoupled from UI mock data.
const STAFF_EMAIL_ROLE_MAP: Record<string, Role> = {
  "yetunde.awoyemi@mcsond.ng": "operations",
  "bashir.musa@mcsond.ng": "finance",
  "ifeoma.nwosu@mcsond.ng": "support",
  "kola.adeyemi@mcsond.ng": "kyc_reviewer",
};

/**
 * Decide a new user's role at account-creation time. Precedence:
 * superadmin allowlist > pending staff invite > static staff map > staff
 * domain default > customer.
 */
async function roleForEmail(email: string): Promise<Role> {
  const e = email.toLowerCase();
  if (SUPERADMIN_EMAILS.has(e)) return "superadmin";

  const invite = await db
    .select({ role: staffInvite.role })
    .from(staffInvite)
    .where(and(eq(staffInvite.email, e), eq(staffInvite.status, "pending")))
    .limit(1);
  if (invite[0]) return invite[0].role as Role;

  if (e.endsWith(`@${STAFF_DOMAIN}`)) return STAFF_EMAIL_ROLE_MAP[e] ?? "support";
  return "user";
}

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Add prod origins via BETTER_AUTH_TRUSTED_ORIGINS (comma-separated).
  trustedOrigins: [
    baseURL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  user: {
    additionalFields: {
      // Customer's business name (label only). Settable at sign-up.
      company: { type: "string", required: false, input: true },
      // KYC status; only staff (kyc_reviewer+) change it, never the user.
      kyc: { type: "string", required: false, input: false, defaultValue: "unverified" },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  // Email + password is a first-class sign-in method (Google OAuth stays as an
  // alternative). Verification is sent best-effort but NOT required to sign in:
  // until EMAIL_FROM is a verified-domain sender, Resend's test address only
  // delivers to the Resend account owner — requiring verification would lock
  // everyone else out.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30, // 30 minutes, single-use
    sendResetPassword: async ({ user, url }) => {
      // Best-effort: sendAuthEmail never throws, so the flow's timing-attack
      // protections and constant responses stay intact.
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your McSond Insurance password",
        heading: "Reset your password",
        body: "Someone (hopefully you) asked to reset the password for this account. The link is valid for 30 minutes.",
        ctaLabel: "Choose a new password",
        ctaUrl: url,
      });
    },
  },
  emailVerification: {
    // Verification has never been required to sign in, so with no mail provider
    // configured we skip the send outright rather than queueing a no-op.
    sendOnSignUp: isEmailConfigured(),
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Fire-and-forget: verification is best-effort and must not slow sign-up.
      void sendAuthEmail({
        to: user.email,
        subject: "Verify your McSond Insurance email",
        heading: "Confirm it's you",
        body: "Tap the button below to verify this email address for your McSond Insurance account.",
        ctaLabel: "Verify email",
        ctaUrl: url,
      });
    },
  },
  session: {
    // Cookie cache OFF so setRole / ban take effect immediately — authorize
    // from the cache()-wrapped server read in lib/server-session.ts instead.
    cookieCache: { enabled: false },
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          return { data: { ...user, role: await roleForEmail(user.email) } };
        },
        async after(user) {
          // Mark a matching pending invite as accepted on first sign-in.
          await db
            .update(staffInvite)
            .set({ status: "accepted" })
            .where(
              and(
                eq(staffInvite.email, user.email.toLowerCase()),
                eq(staffInvite.status, "pending"),
              ),
            );
        },
      },
    },
  },
  plugins: [
    admin({
      ac,
      roles,
      adminRoles: [...STAFF_ROLES],
      defaultRole: "user",
    }),
    // nextCookies() MUST be last, or server-action/RSC cookie writes fail.
    nextCookies(),
  ],
});
