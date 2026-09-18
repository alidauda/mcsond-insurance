/**
 * Drizzle schema for Better Auth (PostgreSQL).
 *
 * Mirrors better-auth 1.6.x core tables (user/session/account/verification)
 * plus the `admin` plugin columns (role, banned, banReason, banExpires on
 * user; impersonatedBy on session). Column names match Better Auth field
 * names (camelCase) so the drizzle adapter resolves them directly.
 *
 * Regenerate with `npm run auth:generate` if plugins/custom fields change,
 * then `npm run db:push`.
 */
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
  // admin plugin
  role: text("role"),
  banned: boolean("banned").$defaultFn(() => false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),
  // app fields (additionalFields in lib/auth.ts)
  company: text("company"),
  // KYC status: verified | pending | unverified. Only staff change it.
  kyc: text("kyc").$defaultFn(() => "unverified"),
  // Identity details the customer DECLARES before any check runs (see
  // lib/kyc.ts). Compared against the national record so that matching a
  // name alone can never claim someone's identity. Locked once linked.
  phone: text("phone"),
  dateOfBirth: text("dateOfBirth"), // YYYY-MM-DD
  gender: text("gender"), // m | f
  stateOfOrigin: text("stateOfOrigin"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // admin plugin
  impersonatedBy: text("impersonatedBy"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt").$defaultFn(() => new Date()),
});

/**
 * Staff invitations (app-owned, not a Better Auth core table). A superadmin
 * creates a pending invite; when the invitee first signs in with Google using
 * the same email, the create hook in lib/auth.ts reads the pending invite,
 * assigns the role, and marks it accepted.
 */
export const staffInvite = pgTable("staff_invite", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").$defaultFn(() => "pending").notNull(), // pending | accepted | revoked
  invitedByEmail: text("invitedByEmail"),
  createdAt: timestamp("createdAt").$defaultFn(() => new Date()).notNull(),
  expiresAt: timestamp("expiresAt"),
});

export const schema = { user, session, account, verification, staffInvite };
