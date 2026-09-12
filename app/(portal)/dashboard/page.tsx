import Link from "next/link";
import {
  PageHeading,
  Card,
  SectionLabel,
  SectionTitle,
  Button,
  Badge,
  Money,
  statusTone,
  statusLabel,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { naira } from "@/lib/format";
import { getDashboard } from "@/lib/dashboard";
import { getLedger } from "@/lib/wallet";

export default async function DashboardPage() {
  const dashboard = await getDashboard();
  const ledger = await getLedger();

  return (
    <div className="flex flex-col gap-10">
      {/* ── Page heading ── */}
      <PageHeading
        eyebrow={dashboard.dateLabel}
        title={
          <>
            Good morning, <em className="italic text-crimson">{dashboard.firstName}.</em>
          </>
        }
        description={dashboard.summary}
        actions={
          <Button variant="primary" icon="shield" href="/insurance">
            Buy cover
          </Button>
        }
      />

      {/* ── Wallet + right rail grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left · wallet card (spans 2) — plain div so bg-navy isn't shadowed by Card's bg-surface */}
        <div className="relative overflow-hidden rounded-[14px] bg-navy p-7 text-surface lg:col-span-2 lg:p-9">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-2 -top-6 select-none font-serif text-[16rem] font-semibold leading-none text-surface/5"
          >
            {dashboard.initial}
          </span>

          <div className="relative flex items-start justify-between gap-4">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-surface/60">
              Wallet · {dashboard.wallet.id}
            </p>
            <Badge tone="success">Active</Badge>
          </div>

          <div className="relative mt-8">
            <Money value={dashboard.wallet.balance} className="text-5xl sm:text-6xl" />
            <p className="mt-3 text-sm text-surface/60">
              Available balance · Last reconciled {dashboard.wallet.lastReconciled}
            </p>
          </div>

          <div className="relative mt-9 flex flex-wrap items-center gap-3">
            <Button variant="accent" icon="plus" href="/wallet">
              Top up
            </Button>
            <Button icon="arrowUp" className="bg-surface/15 text-surface hover:bg-surface/25">
              Send
            </Button>
            <Button
              icon="arrowDown"
              href="/wallet"
              className="border border-surface/30 bg-transparent text-surface hover:bg-surface/10"
            >
              Statement
            </Button>
          </div>
        </div>

        {/* Right rail · stacked cards (1 col) */}
        <div className="flex flex-col gap-6">
          {/* Active policies */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <SectionLabel>Active policies</SectionLabel>
              <span className="font-serif text-lg font-semibold text-navy tnum">
                {dashboard.activePolicies.length}
              </span>
            </div>

            {dashboard.activePolicies.length === 0 ? (
              <div className="mt-5 grid place-items-center rounded-[10px] border border-dashed border-line py-10 text-center">
                <p className="text-sm text-muted">No active cover yet.</p>
                <Button variant="outline" icon="shield" href="/insurance" className="mt-3">
                  Compare quotes
                </Button>
              </div>
            ) : (
              <ul className="mt-5 flex flex-col gap-4">
                {dashboard.activePolicies.map((policy) => (
                  <li key={policy.orderId}>
                    <Link
                      href={`/orders/${policy.orderId}`}
                      className="flex items-center justify-between gap-3 rounded-[10px] transition-opacity hover:opacity-80"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{policy.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {policy.underwriter} · expires {policy.expires}
                        </p>
                      </div>
                      <Badge tone={statusTone(policy.status)}>{statusLabel(policy.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Cover at a glance */}
          <Card className="p-6">
            <SectionLabel>Total cover</SectionLabel>
            <p className="mt-3 font-serif text-3xl font-semibold text-navy tnum">{naira(dashboard.totalCover)}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <Icon name="shieldCheck" className="size-4 text-success" />
              Sum insured across your active policies
            </p>
          </Card>
        </div>
      </div>

      {/* ── Recent activity ── */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <SectionTitle>Recent activity</SectionTitle>
          <Button variant="ghost" href="/wallet" className="px-0 hover:bg-transparent">
            <span className="font-medium text-crimson hover:text-crimson-700">View ledger →</span>
          </Button>
        </div>

        <Card className="mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-line font-mono text-xs uppercase tracking-[0.14em] text-muted">
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted">
                      No movements yet — top up your wallet to get started.
                    </td>
                  </tr>
                )}
                {ledger.slice(0, 4).map((entry, i) => {
                  const settled = i === 0 ? "posted" : "settled";
                  return (
                    <tr key={entry.ref} className="border-b border-line last:border-0 text-sm">
                      <td className="px-6 py-5 font-mono text-xs tracking-wide text-ink-soft">{entry.ref}</td>
                      <td className="px-6 py-5 whitespace-nowrap text-muted">{entry.date}</td>
                      <td className="px-6 py-5">
                        <Badge tone="neutral" dot={false}>
                          {entry.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-5 text-ink">{entry.description}</td>
                      <td className="px-6 py-5 text-right">
                        <Money value={entry.amount} sign colorBySign />
                      </td>
                      <td className="px-6 py-5">
                        <Badge tone={settled === "posted" ? "warning" : "success"}>{settled}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
