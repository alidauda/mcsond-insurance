import {
  PageHeading,
  Card,
  Button,
  Avatar,
  Badge,
  Divider,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { getAuditTrail, getAuditSummary } from "@/lib/audit";

export default async function AdminAuditPage() {
  const [auditTrail, auditSummary] = await Promise.all([
    getAuditTrail(),
    getAuditSummary(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow="Audit Trail · Immutable · 90-Day Retention"
        title={
          <>
            Every <em className="italic text-crimson">change.</em> Forever.
          </>
        }
        actions={
          <>
            <Button variant="outline" icon="calendar">
              {auditSummary.date}
            </Button>
            <Button variant="outline" icon="filter">
              All actors
            </Button>
            <Button variant="outline" icon="download">
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left · audit log table ── */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
                  <th className="py-3 pl-5 pr-4 font-medium">Time</th>
                  <th className="py-3 pr-4 font-medium">Actor</th>
                  <th className="py-3 pr-4 font-medium">Action</th>
                  <th className="py-3 pr-4 font-medium">Target</th>
                  <th className="py-3 pr-5 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.map((entry, i) => (
                  <tr
                    key={`${entry.time}-${i}`}
                    className="border-b border-line last:border-0 transition-colors hover:bg-canvas/60"
                  >
                    <td className="py-4 pl-5 pr-4 align-middle">
                      <span className="font-mono text-sm text-ink-soft tnum">{entry.time}</span>
                    </td>
                    <td className="py-4 pr-4 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={entry.actorInitial} className="size-7 text-[0.65rem]" />
                        <span className="whitespace-nowrap text-sm font-medium text-ink">
                          {entry.actor}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 pr-4 align-middle">
                      <Badge tone={entry.actionTone === "danger" ? "danger" : "neutral"}>
                        {entry.action}
                      </Badge>
                    </td>
                    <td className="py-4 pr-4 align-middle">
                      <span className="font-mono text-sm text-ink-soft">{entry.target}</span>
                    </td>
                    <td className="py-4 pr-5 align-middle">
                      <span className="text-sm leading-snug text-muted">{entry.detail}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Right · summary + tamper-evidence ── */}
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">Today</p>
            <p className="mt-3 font-serif text-5xl font-semibold leading-none text-navy tnum">
              {auditSummary.total}
            </p>
            <p className="mt-2 text-sm text-muted">events recorded</p>

            <Divider className="my-5" />

            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">By staff</dt>
                <dd className="font-mono font-medium text-ink tnum">{auditSummary.byStaff}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">By system</dt>
                <dd className="font-mono font-medium text-ink tnum">{auditSummary.bySystem}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">By super admin</dt>
                <dd className="font-mono font-medium text-ink tnum">{auditSummary.bySuperAdmin}</dd>
              </div>
            </dl>
          </Card>

          <Card className="border-crimson/30 bg-danger-bg p-6">
            <div className="flex items-center gap-2.5">
              <Icon name="shield" className="size-5 text-crimson" />
              <h2 className="font-serif text-lg font-semibold text-navy">Tamper-evident</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Audit entries are hash-chained. The current head hash matches the redundant ledger.
            </p>
            <p className="mt-4 font-mono text-[0.72rem] tracking-wide text-crimson">
              {auditSummary.headHash} · verified {auditSummary.verified}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
