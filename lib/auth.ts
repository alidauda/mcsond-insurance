import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { schema, staffInvite } from "./auth-schema";
import { ac, roles, STAFF_ROLES, type Role } from "./permissions";

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
  // Google is the only sign-in method. Email/password is deliberately off:
  // Google accounts arrive verified, so there is no verification or reset flow
  // to maintain, and staff gating by domain stays reliable.
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Always show Google's account chooser — a browser signed into one Google
      // account would otherwise be picked silently (see the alidauda14 / ali.biu mix-up).
      prompt: "select_account",
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
