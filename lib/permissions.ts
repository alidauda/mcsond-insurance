/**
 * Access-control model — the single source of truth for staff roles and
 * permissions. Framework-agnostic: imported by both the Better Auth server
 * (`lib/auth.ts`) and the client (`lib/auth-client.ts`), and used to render
 * the permission matrix on `/admin/staff`.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  user: ["list", "kyc", "ban", "set-role", "impersonate", "delete", "create"],
  wallet: ["view", "adjust"],
  order: ["view", "refund"],
  product: ["view", "manage"],
  ticket: ["view", "respond"],
  report: ["view"],
  audit: ["view"],
  settings: ["view", "manage"],
} as const;

export const ac = createAccessControl(statement);

export const operations = ac.newRole({
  user: ["list"],
  wallet: ["view"],
  order: ["view", "refund"],
  product: ["view", "manage"],
  ticket: ["view", "respond"],
  report: ["view"],
});

export const finance = ac.newRole({
  user: ["list"],
  wallet: ["view", "adjust"],
  order: ["view", "refund"],
  report: ["view"],
  audit: ["view"],
});

export const support = ac.newRole({
  user: ["list"],
  ticket: ["view", "respond"],
});

// KYC reviewers can see customers and approve their identity checks.
export const kyc_reviewer = ac.newRole({
  user: ["list", "kyc"],
});

// Full access: admin-plugin defaults + every custom statement.
export const superadmin = ac.newRole({
  ...adminAc.statements,
  ...statement,
});

// Customers: no staff permissions.
export const user = ac.newRole({});

export const roles = { superadmin, operations, finance, support, kyc_reviewer, user };

/** Staff roles authorized on admin-plugin endpoints. */
export const STAFF_ROLES = ["superadmin", "operations", "finance", "support", "kyc_reviewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type Role = StaffRole | "user";
