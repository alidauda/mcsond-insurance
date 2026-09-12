"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Badge, Table, Th, Td, FilterChips, type BadgeTone, type FilterChip } from "@/components/ui";

/** Row shape mapped from `auth.api.listUsers`. */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  company: string;
  kyc: "verified" | "pending" | "unverified";
  banned: boolean;
  createdAt: string;
}

const kycTone: Record<UserRow["kyc"], BadgeTone> = {
  verified: "success",
  pending: "warning",
  unverified: "danger",
};

function matches(row: UserRow, filter: string): boolean {
  switch (filter) {
    case "all":
      return true;
    case "suspended":
      return row.banned;
    case "active":
      return !row.banned;
    case "kyc:verified":
    case "kyc:pending":
    case "kyc:unverified":
      return row.kyc === filter.slice(4);
    default:
      return true;
  }
}

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const [filter, setFilter] = useState("all");

  const chips: FilterChip[] = [
    { value: "all", label: "All", count: rows.length },
    { value: "active", label: "Active", count: rows.filter((r) => !r.banned).length },
    { value: "kyc:verified", label: "Verified", count: rows.filter((r) => r.kyc === "verified").length },
    { value: "kyc:pending", label: "KYC pending", count: rows.filter((r) => r.kyc === "pending").length },
    { value: "kyc:unverified", label: "Unverified", count: rows.filter((r) => r.kyc === "unverified").length },
    { value: "suspended", label: "Suspended", count: rows.filter((r) => r.banned).length },
  ];

  const visible = rows.filter((r) => matches(r, filter));

  return (
    <div>
      <FilterChips chips={chips} value={filter} onChange={setFilter} />
      <div className="mt-5">
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Company</Th>
              <Th>KYC</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="bg-surface transition-colors hover:bg-surface-soft">
                <Td>
                  <Link href={`/admin/users/${r.id}`} className="flex items-center gap-3">
                    <Avatar initials={r.initials} />
                    <span className="leading-tight">
                      <span className="block font-medium text-ink">{r.name}</span>
                      <span className="block text-xs text-muted">{r.email}</span>
                    </span>
                  </Link>
                </Td>
                <Td className="text-ink">{r.company}</Td>
                <Td>
                  <Badge tone={kycTone[r.kyc]}>{r.kyc}</Badge>
                </Td>
                <Td>
                  {r.banned ? <Badge tone="danger">Suspended</Badge> : <Badge tone="neutral">Active</Badge>}
                </Td>
                <Td>{r.createdAt}</Td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <Td className="text-center text-muted" >
                  No users match this filter.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
