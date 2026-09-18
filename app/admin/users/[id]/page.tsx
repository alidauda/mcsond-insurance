import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Eyebrow, Avatar, Badge, Card, Table, Th, Td, type BadgeTone } from "@/components/ui";
import { UserActions } from "@/components/admin/UserActions";
import { RevokeSessionsButton } from "@/components/admin/RevokeSessionsButton";
import { auth } from "@/lib/auth";
import { getUserDetail, type UserDetail } from "@/lib/admin-users";
import { getKycEvidence, getKycAttempts, getKycPhoto, canViewKycPhoto, getLatestAttemptIdentity, getDeclaredIdentity } from "@/lib/kyc";
import { KycPanel } from "@/components/admin/KycPanel";

// Request-time only (no generateStaticParams): data depends on the live DB and
// the caller's session.
export const dynamic = "force-dynamic";

const kycTone: Record<UserDetail["kyc"], BadgeTone> = {
  verified: "success",
  pending: "warning",
  unverified: "danger",
};

interface SessionRow {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  updatedAt?: string | Date;
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getUserDetail(id);
  if (!account) notFound();
  const [kycEvidence, kycAttempts, kycLatest, canSeePhoto, declared] = await Promise.all([
    getKycEvidence(id),
    getKycAttempts(id, 8),
    getLatestAttemptIdentity(id),
    canViewKycPhoto(),
    getDeclaredIdentity(id),
  ]);
  // Biometric data only loads for staff holding user:kyc.
  const kycPhoto = canSeePhoto ? await getKycPhoto(id) : null;

  // Listing sessions needs its own admin-plugin permission; roles without it
  // (e.g. support) still get the rest of the page instead of a 500.
  let sessions: SessionRow[] = [];
  let sessionsRestricted = false;
  try {
    const sessionsRes = await auth.api.listUserSessions({
      headers: await headers(),
      body: { userId: id },
    });
    sessions = ((sessionsRes as { sessions?: SessionRow[] }).sessions ?? []) as SessionRow[];
  } catch {
    sessionsRestricted = true;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/users" className="text-sm text-muted hover:text-navy">
        ← Back to users
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar initials={account.initials} className="size-14" />
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-navy">
              {account.name}
            </h1>
            <p className="text-muted">{account.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={kycTone[account.kyc]}>KYC {account.kyc}</Badge>
          {account.banned ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
        </div>
      </div>

      {/* Action bar — permissions enforced inside the server actions */}
      <Card className="mt-6 p-4">
        <UserActions userId={account.id} banned={account.banned} kyc={account.kyc} />
      </Card>

      {/* Details */}
      <Card className="mt-4 p-5">
        <Eyebrow>Account</Eyebrow>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Company</dt>
            <dd className="text-ink">{account.company}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Role</dt>
            <dd className="text-ink">{account.role}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Joined</dt>
            <dd className="text-ink">{account.createdAt}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">User ID</dt>
            <dd className="font-mono text-xs text-ink">{account.id}</dd>
          </div>
        </dl>
      </Card>

      {/* KYC evidence + review */}
      <KycPanel
        userId={account.id}
        accountName={account.name}
        status={account.kyc}
        evidence={kycEvidence}
        latest={kycLatest}
        attempts={kycAttempts}
        photo={kycPhoto}
        canViewPhoto={canSeePhoto}
        declared={declared}
      />

      {/* Active session log */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-navy">Active session log</h2>
        <RevokeSessionsButton userId={account.id} disabled={sessionsRestricted || sessions.length === 0} />
      </div>
      <div className="mt-3">
        <Table>
          <thead>
            <tr>
              <Th>Device</Th>
              <Th>IP</Th>
              <Th>Last seen</Th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="bg-surface">
                <Td className="text-ink">{s.userAgent ?? "Unknown device"}</Td>
                <Td className="font-mono text-xs">{s.ipAddress ?? "—"}</Td>
                <Td>{s.updatedAt ? new Date(s.updatedAt).toISOString().slice(0, 16).replace("T", " ") : "—"}</Td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <Td className="text-center text-muted">
                  {sessionsRestricted ? "Your role can't view session data." : "No active sessions."}
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
