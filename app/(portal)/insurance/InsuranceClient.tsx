"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { FilterChips } from "@/components/Interactive";
import { PageHeading, Card, Button, Badge, Money, Divider, cx } from "@/components/ui";
import { KycGate } from "@/components/KycGate";
import { insuranceCategories, type InsurancePlan, type KycStatus } from "@/lib/mock-data";
import { naira } from "@/lib/format";

/**
 * Plan browse. McSond is a broker: every plan is priced and issued by an
 * underwriter's API, so there is no in-app quote form here — choosing a plan
 * hands the customer to that underwriter's quote flow.
 */
export default function InsuranceClient({
  plans,
  underwriters,
  blurb,
  walletBalance,
  initialPlanId,
  kycStatus,
}: {
  plans: InsurancePlan[];
  underwriters: number;
  blurb: string;
  customerName: string;
  walletBalance: number;
  initialPlanId?: string;
  kycStatus: KycStatus;
}) {
  const [category, setCategory] = useState("All");

  const chips = insuranceCategories.map((c) => ({ key: c, label: c }));
  const visible = category === "All" ? plans : plans.filter((p) => p.category === category);
  const highlighted = initialPlanId ?? plans.find((p) => p.popular)?.id;

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow={`Insurance · ${underwriters} underwriter${underwriters === 1 ? "" : "s"}`}
        title={
          <>
            Cover, <em className="italic text-crimson">quoted at the wholesale rate.</em>
          </>
        }
        description={blurb}
        actions={
          <div className="flex items-center gap-2 rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm">
            <Icon name="wallet" className="size-4 text-muted" />
            <span className="text-muted">Wallet</span>
            <span className="font-mono tnum text-ink">{naira(walletBalance)}</span>
          </div>
        }
      />

      <KycGate status={kycStatus} />

      <FilterChips items={chips} value={category} onChange={setCategory} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((p) => {
          const featured = p.id === highlighted;
          const href = `/insurance/motor?plan=${encodeURIComponent(p.id)}`;
          return (
            <Card
              key={p.id}
              as="article"
              className={cx("flex flex-col p-6", featured && "ring-2 ring-navy")}
            >
              <div className="flex items-start justify-between">
                <span className="inline-grid size-9 place-items-center rounded-[10px] bg-navy/5 text-navy">
                  <Icon name="shield" className="size-5" />
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone="info" dot={false} mono>
                    Live · {p.underwriter.split(" ")[0]}
                  </Badge>
                  {p.popular && (
                    <Badge tone="danger" dot>
                      Popular
                    </Badge>
                  )}
                </span>
              </div>

              <h3 className="mt-5 font-serif text-lg font-semibold text-navy">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">Underwritten by {p.underwriter}</p>

              {p.premium > 0 ? (
                <Money value={p.premium} className="mt-5 block text-3xl text-navy" />
              ) : (
                <span className="mt-5 block font-serif text-3xl font-semibold tnum text-navy">5%</span>
              )}
              <p className="mt-1 text-xs text-muted">
                {p.premium > 0 ? `from · ${p.term}` : p.term}
              </p>

              <Divider className="my-5" />

              <ul className="flex flex-col gap-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-ink-soft">
                    <Icon name="check" className="size-4 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button href={href} variant={featured ? "primary" : "outline"} className="mt-6 w-full">
                Get a quote →
              </Button>
            </Card>
          );
        })}

        {visible.length === 0 && (
          <Card className="p-6 text-sm text-muted sm:col-span-2 xl:col-span-3">
            No plans in this category yet.
          </Card>
        )}
      </div>

      <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon name="shieldCheck" className="mt-0.5 size-5 shrink-0 text-navy" />
          <div>
            <p className="text-sm font-semibold text-ink">Every policy is issued by a licensed underwriter</p>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              McSond is a broker. We price your cover against the underwriter&rsquo;s live rates and pay from your
              wallet; they carry the risk and issue the NAICOM-registered certificate, usually within seconds.
            </p>
          </div>
        </div>
        <Link href="/orders" className="shrink-0 text-sm font-medium text-crimson hover:text-crimson-700">
          Your policies →
        </Link>
      </Card>
    </div>
  );
}
