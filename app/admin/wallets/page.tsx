import {
  PageHeading,
  Card,
  SectionTitle,
  Avatar,
  Money,
  cx,
} from "@/components/ui";
import { getAdminWallets } from "@/lib/wallet";
import { ReconcileButton } from "./ReconcileButton";

export default async function AdminWalletsPage() {
  const adminWallets = await getAdminWallets();

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow={<>Wallets · Float {adminWallets.floatLabel}</>}
        title={
          <>
            The <em className="italic text-crimson">float</em>, every kobo.
          </>
        }
        actions={<ReconcileButton />}
      />

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {adminWallets.tiles.map((t) => {
          const reconciled = t.delta === "reconciled";
          return (
            <Card key={t.label} className="flex flex-col gap-3 p-5">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
                {t.label}
              </p>
              <p className="font-serif tnum text-4xl font-semibold text-navy">{t.value}</p>
              <p
                className={cx(
                  "font-mono text-xs",
                  reconciled || t.up ? "text-success" : "text-crimson",
                )}
              >
                {t.delta}
              </p>
            </Card>
          );
        })}
      </div>

      {/* ── Top wallet balances ── */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="flex flex-col gap-6 p-6">
          <SectionTitle className="text-xl">Top wallet balances</SectionTitle>
          {adminWallets.topBalances.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">No funded wallets yet.</p>
          )}
          <ul className="flex flex-col">
            {adminWallets.topBalances.map((w, i) => (
              <li
                key={w.id}
                className={cx(
                  "flex items-center justify-between gap-4 py-4",
                  i !== 0 && "border-t border-line",
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar initials={w.initials} />
                  <div className="leading-tight">
                    <p className="text-sm font-medium text-ink">{w.name}</p>
                    <p className="font-mono text-[0.7rem] text-muted">{w.id}</p>
                  </div>
                </div>
                <Money value={w.amount} className="text-base" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
