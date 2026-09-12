"use client";

import { useState } from "react";
import {
  PageHeading,
  Card,
  SectionLabel,
  SectionTitle,
  Button,
  Badge,
  statusTone,
  statusLabel,
} from "@/components/ui";
import { Sparkline, StackedBars, Donut } from "@/components/charts";
import { Segmented } from "@/components/Interactive";
import { nairaCompact } from "@/lib/format";
import type {
  getAdminKpis,
  getVolumeByCategory,
  getGwpByUnderwriter,
  getLiveEvents,
  getServiceHealth,
} from "@/lib/admin-overview";

type AdminKpis = Awaited<ReturnType<typeof getAdminKpis>>;
type VolumeByCategory = Awaited<ReturnType<typeof getVolumeByCategory>>;
type GwpByUnderwriter = Awaited<ReturnType<typeof getGwpByUnderwriter>>;
type LiveEvents = Awaited<ReturnType<typeof getLiveEvents>>;
type ServiceHealth = Awaited<ReturnType<typeof getServiceHealth>>;

export function AdminOverview({
  adminKpis,
  volumeByCategory,
  gwpByUnderwriter,
  liveEvents,
  serviceHealth,
}: {
  adminKpis: AdminKpis;
  volumeByCategory: VolumeByCategory;
  gwpByUnderwriter: GwpByUnderwriter;
  liveEvents: LiveEvents;
  serviceHealth: ServiceHealth;
}) {
  const [range, setRange] = useState(volumeByCategory.activeToggle);
  const dataset =
    volumeByCategory.datasets[range] ??
    volumeByCategory.datasets[volumeByCategory.activeToggle];
  const stackColors = volumeByCategory.series.map((s) => s.color);

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow="Operations · Live"
        title={
          <>
            The brokerage, <em className="italic text-crimson">at a glance.</em>
          </>
        }
        actions={
          <>
            <Button variant="outline" icon="calendar">
              Last 30 days
            </Button>
            <Button variant="outline" icon="download">
              Export
            </Button>
          </>
        }
      />

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {adminKpis.map((kpi) => (
          <Card key={kpi.label} className="flex flex-col gap-4 p-5">
            <SectionLabel>{kpi.label}</SectionLabel>
            <p className="font-serif text-4xl font-semibold tnum text-navy">{kpi.value}</p>
            <div className="flex items-end justify-between gap-3">
              <span className={kpi.up ? "text-sm font-medium text-success" : "text-sm font-medium text-crimson"}>
                {kpi.delta}
              </span>
              <Sparkline points={kpi.trend} color="var(--color-navy)" className="h-9 w-24" />
            </div>
          </Card>
        ))}
      </div>

      {/* ── Volume by category + GWP by underwriter ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle className="text-xl">Volume by category</SectionTitle>
            <Segmented options={volumeByCategory.toggles} value={range} onChange={setRange} />
          </div>

          <StackedBars data={dataset.data} colors={stackColors} labels={dataset.labels} />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {volumeByCategory.series.map((s) => (
              <span key={s.name} className="flex items-center gap-2 text-sm text-ink-soft">
                <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-6 p-6">
          <SectionTitle className="text-xl">GWP by underwriter</SectionTitle>

          {gwpByUnderwriter.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No policies bound yet.</p>
          ) : (
            <div className="flex flex-col items-center gap-8 sm:flex-row sm:gap-6">
              <Donut segments={gwpByUnderwriter} className="shrink-0" />

              <ul className="flex w-full flex-col gap-3">
                {gwpByUnderwriter.map((u) => (
                  <li key={u.label} className="flex items-center gap-3 text-sm">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: u.color }} />
                    <span className="text-ink-soft">{u.label}</span>
                    <span className="ml-auto font-mono text-xs text-muted">{nairaCompact(u.amount)}</span>
                    <span className="w-10 text-right font-mono tnum text-ink">{u.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* ── Live system events + Service health ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle className="text-xl">Live system events</SectionTitle>
            <Badge tone="success">streaming</Badge>
          </div>

          {liveEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No activity recorded yet.</p>
          ) : (
            <ul className="flex flex-col">
              {liveEvents.map((e, i) => (
                <li key={e.time + i} className="flex items-baseline gap-4 border-b border-line py-3 last:border-0">
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{e.time}</span>
                  <span className="text-sm text-ink">{e.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-5 p-6">
          <SectionTitle className="text-xl">Service health</SectionTitle>

          {serviceHealth.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No integrations configured.</p>
          ) : (
            <ul className="flex flex-col">
              {serviceHealth.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                  <span className="text-sm font-medium text-ink">{s.name}</span>
                  <Badge tone={statusTone(s.status)}>{statusLabel(s.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
