import { Eyebrow, Avatar, Badge, Card, Table, Th, Td } from "@/components/ui";
import { Icon } from "@/components/icons";
import { listStaff, buildMatrix } from "@/lib/admin-staff";
import { listPendingInvites } from "@/lib/admin-invites";
import { InviteStaff, RevokeInviteButton } from "@/components/admin/StaffInvites";
import type { StaffRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const roleLabels: Record<StaffRole, string> = {
  superadmin: "Super Admin",
  operations: "Operations",
  finance: "Finance",
  support: "Support",
  kyc_reviewer: "KYC Reviewer",
};

export default async function AdminStaffPage() {
  const members = await listStaff();
  const { roles: matrixRoles, rows } = buildMatrix();
  const invites = await listPendingInvites();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow className="text-muted">Staff &amp; roles</Eyebrow>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-navy">
            Internal team
          </h1>
          <p className="mt-2 text-muted">
            {members.length} staff members across {matrixRoles.length} roles.
          </p>
        </div>
        <InviteStaff />
      </div>

      {/* Pending invitations */}
      {invites.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-xl font-semibold text-navy">Pending invitations</h2>
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Invited by</Th>
                  <Th>Sent</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="bg-surface">
                    <Td className="text-ink">{inv.email}</Td>
                    <Td>
                      <Badge tone="neutral">{roleLabels[inv.role]}</Badge>
                    </Td>
                    <Td>{inv.invitedByEmail ?? "—"}</Td>
                    <Td>{inv.createdAt}</Td>
                    <Td className="text-right">
                      <RevokeInviteButton id={inv.id} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}

      {/* Staff list */}
      <h2 className="mt-8 font-serif text-xl font-semibold text-navy">Members</h2>
      <div className="mt-3">
        <Table>
          <thead>
            <tr>
              <Th>Member</Th>
              <Th>Role</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="bg-surface">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar initials={m.initials} />
                    <span className="leading-tight">
                      <span className="block font-medium text-ink">{m.name}</span>
                      <span className="block text-xs text-muted">{m.email}</span>
                    </span>
                  </div>
                </Td>
                <Td>
                  <Badge tone={m.role === "superadmin" ? "danger" : "neutral"}>{roleLabels[m.role]}</Badge>
                </Td>
                <Td>{m.createdAt}</Td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <Td className="text-center text-muted">No staff members yet.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Permission matrix — derived from lib/permissions.ts */}
      <h2 className="mt-10 font-serif text-xl font-semibold text-navy">Permission matrix</h2>
      <Card className="mt-3 overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Capability</Th>
              {matrixRoles.map((r) => (
                <Th key={r} className="text-center">{roleLabels[r]}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cap) => (
              <tr key={cap.key} className="bg-surface">
                <Td className="font-medium text-ink">{cap.label}</Td>
                {matrixRoles.map((r) => (
                  <Td key={r} className="text-center">
                    {cap.grants[r] ? (
                      <Icon name="check" className="mx-auto size-4 text-success" />
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
