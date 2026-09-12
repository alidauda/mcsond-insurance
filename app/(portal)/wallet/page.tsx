import {
  PageHeading,
  Card,
  SectionLabel,
  SectionTitle,
  Button,
  Badge,
  Money,
  type BadgeTone,
} from "@/components/ui";
import { AreaSpark } from "@/components/charts";
import { getWalletStats, getLedger, getWalletReference } from "@/lib/wallet";
import { TopUpForm } from "./TopUpForm";

/* Ledger type → dot Badge tone. */
function typeTone(type: string): BadgeTone {
  switch (type) {
    case "Insurance":
      return "danger";
    case "Wallet top-up":
      return "success";
    default:
      return "neutral";
  }
}

const TOPUP_BANNERS: Record<string, { tone: string; text: string }> = {
  success: {
    tone: "border-success/30 bg-success-bg text-success",
    text: "Top-up received — your wallet has been credited.",
  },
  failed: {
    tone: "border-crimson/30 bg-danger-bg text-crimson",
    text: "That payment didn’t complete. No money left your account.",
  },
  pending: {
    tone: "border-warning/30 bg-warning-bg text-warning",
    text: "Your payment is still going through. We’ll credit your wallet the moment it settles — no need to pay again.",
  },
  error: {
    tone: "border-warning/30 bg-warning-bg text-warning",
    text: "We couldn’t confirm the payment yet — if you were charged, the wallet will credit as soon as Paystack notifies us.",
  },
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string }>;
}) {
  const [walletStats, ledger, walletRef, sp] = await Promise.all([
    getWalletStats(),
    getLedger(),
    getWalletReference(),
    searchParams,
  ]);
  const banner = sp.topup ? TOPUP_BANNERS[sp.topup] : undefined;

  return (
    <div className="space-y-10">
      <PageHeading
        eyebrow={walletRef ? `WALLET · ${walletRef}` : "WALLET"}
        title={
          <>
            Move money <em className="italic text-crimson">once.</em>
          </>
        }
      />

      {banner && (
        <div className={`rounded-[12px] border px-5 py-4 text-sm font-medium ${banner.tone}`}>
          {banner.text}
        </div>
      )}

      {/* ── Stat tiles ── */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Available */}
        <Card className="flex flex-col p-6">
          <SectionLabel>Available</SectionLabel>
          <Money value={walletStats.available} className="mt-4 text-4xl sm:text-5xl" />
          <TopUpForm />
        </Card>

        {/* Spent this month */}
        <Card className="flex flex-col p-6">
          <SectionLabel>Spent this month</SectionLabel>
          <Money value={walletStats.spentThisMonth} className="mt-4 text-4xl sm:text-5xl" />
          <AreaSpark
            points={walletStats.spendTrend}
            color="var(--color-crimson)"
            className="mt-auto h-16 w-full pt-6"
          />
        </Card>

        {/* Earmarked */}
        <Card className="flex flex-col p-6">
          <SectionLabel>Earmarked</SectionLabel>
          <Money value={walletStats.earmarked} className="mt-4 text-4xl sm:text-5xl" />
          <p className="mt-6 text-sm text-muted">{walletStats.earmarkedNote}</p>
        </Card>
      </div>

      {/* ── Ledger ── */}
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle>Ledger</SectionTitle>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="outline" icon="download" className="px-4 py-2.5 text-sm">
              Export CSV
            </Button>
          </div>
        </div>

        <Card className="mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 text-right font-medium">Old balance</th>
                  <th className="px-6 py-4 text-right font-medium">In / out</th>
                  <th className="px-6 py-4 text-right font-medium">New balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-muted">
                      No movements yet — top up to get started.
                    </td>
                  </tr>
                )}
                {ledger.map((entry, i) => (
                  <tr
                    key={`${entry.ref}-${i}`}
                    className="border-b border-line last:border-0 hover:bg-canvas/60"
                  >
                    <td className="px-6 py-5 font-mono text-sm text-ink-soft">{entry.ref}</td>
                    <td className="px-6 py-5 text-sm text-muted">{entry.date}</td>
                    <td className="px-6 py-5">
                      <Badge tone={typeTone(entry.type)} dot mono>
                        {entry.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 text-sm text-ink">{entry.description}</td>
                    <td className="px-6 py-5 text-right">
                      <Money value={entry.balanceBefore} className="text-sm text-muted" />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Money value={entry.amount} sign colorBySign className="text-sm" />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Money value={entry.runningBalance} className="text-sm text-ink" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
