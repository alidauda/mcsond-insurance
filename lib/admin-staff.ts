import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { roles, statement, STAFF_ROLES, type StaffRole } from "./permissions";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: StaffRole;
  createdAt: string;
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/** Staff members (non-customer roles) via the admin API. */
export async function listStaff(): Promise<StaffRow[]> {
  const res = await auth.api.listUsers({
    headers: await headers(),
    query: { limit: 200, sortBy: "createdAt", sortDirection: "desc" },
  });
  return res.users
    .filter((u) => STAFF_ROLES.includes(u.role as StaffRole))
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      initials: initials(u.name),
      role: u.role as StaffRole,
      createdAt: new Date(u.createdAt).toISOString().slice(0, 10),
    }));
}

export interface MatrixRow {
  /** e.g. "user:list" */
  key: string;
  label: string;
  grants: Record<StaffRole, boolean>;
}

const RESOURCE_LABELS: Record<string, string> = {
  user: "Users",
  wallet: "Wallet",
  order: "Orders",
  ticket: "Tickets",
  report: "Reports",
  audit: "Audit",
  settings: "Settings",
};

// Resource:action pairs we surface in the matrix (a readable subset of the
// full statement). Derived from lib/permissions.ts — the single source.
const MATRIX_KEYS: [resource: string, action: string][] = [
  ["user", "list"],
  ["user", "kyc"],
  ["wallet", "view"],
  ["wallet", "adjust"],
  ["order", "refund"],
  ["ticket", "respond"],
  ["report", "view"],
  ["audit", "view"],
  ["settings", "manage"],
];

/** Build the permission matrix straight from the access-control roles. */
export function buildMatrix(): { roles: StaffRole[]; rows: MatrixRow[] } {
  // Display order: scoped roles first, superadmin (full access) last.
  const roleList: readonly StaffRole[] = ["operations", "finance", "support", "kyc_reviewer", "superadmin"];
  const rows: MatrixRow[] = MATRIX_KEYS
    // only show pairs that exist in the statement
    .filter(([res, act]) => (statement as Record<string, readonly string[]>)[res]?.includes(act))
    .map(([res, act]) => {
      const grants = Object.fromEntries(
        roleList.map((r) => {
          const ok = roles[r].authorize({ [res]: [act] } as Parameters<typeof roles[typeof r]["authorize"]>[0]).success;
          return [r, ok];
        }),
      ) as Record<StaffRole, boolean>;
      return { key: `${res}:${act}`, label: `${RESOURCE_LABELS[res]} — ${act}`, grants };
    });
  return { roles: [...roleList], rows };
}
