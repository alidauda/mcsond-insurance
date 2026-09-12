"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeading,
  Card,
  SectionLabel,
  Badge,
  Avatar,
  Money,
  Button,
  statusLabel,
  cx,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { FilterChips } from "@/components/Interactive";
import { adminOrderFilters, orderStageTone, type AdminOrder } from "@/lib/mock-data";

export function AdminOrdersTable({ adminOrders }: { adminOrders: AdminOrder[] }) {
  const router = useRouter();
  const [active, setActive] = useState("all");

  const rows = useMemo(() => {
    switch (active) {
      case "active":
        return adminOrders.filter((o) => o.stage === "active" || o.stage === "renew");
      case "renew":
      case "expired":
      case "cancelled":
        return adminOrders.filter((o) => o.stage === active);
      case "failed":
        return adminOrders.filter((o) => o.stage === "failed" || o.stage === "pending");
      default:
        return adminOrders;
    }
  }, [active, adminOrders]);

  const live = adminOrders.filter((o) => o.stage === "active" || o.stage === "renew").length;
  const renewing = adminOrders.filter((o) => o.stage === "renew").length;
  const cancelled = adminOrders.filter((o) => o.stage === "cancelled").length;
  const gwp = adminOrders
    .filter((o) => o.stage !== "cancelled" && o.stage !== "failed" && o.stage !== "pending")
    .reduce((s, o) => s + (o.premium ?? o.total), 0);

  const stats = [
    { label: "Active policies", value: String(live), tone: false },
    { label: "Renewing soon", value: String(renewing), tone: renewing > 0 },
    { label: "Cancelled", value: String(cancelled), tone: false },
    { label: "Gross written premium", value: <Money value={gwp} />, tone: false },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow={`Policy book · ${adminOrders.length} policies`}
        title={
          <>
            The <em className="italic text-crimson">policy book.</em>
          </>
        }
        actions={
          <>
            <Button variant="outline" icon="filter">
              Filter
            </Button>
            <Button variant="outline" icon="download">
              Export
            </Button>
          </>
        }
      />

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <SectionLabel>{s.label}</SectionLabel>
            <p className={cx("mt-2 font-serif text-3xl font-semibold", s.tone ? "text-crimson" : "text-navy")}>
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <FilterChips items={adminOrderFilters} value={active} onChange={setActive} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
                <th className="px-6 py-4 font-medium">Policy</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Cover</th>
                <th className="px-6 py-4 font-medium">Underwriter</th>
                <th className="px-6 py-4 font-medium">Period</th>
                <th className="px-6 py-4 text-right font-medium">Total</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="w-10 px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/admin/orders/${o.id}`)}
                  className="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-canvas/60"
                >
                  <td className="px-6 py-4 font-mono text-xs text-ink-soft">{o.id}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={o.customerInitials} className="size-7 text-[0.65rem]" />
                      <span className="text-ink">{o.customer}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-ink">{o.item.replace(/\s*\(.*\)$/, "")}</td>
                  <td className="px-6 py-4">
                    <Badge tone="neutral" dot mono>
                      {o.underwriter ?? "—"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-ink-soft">{o.period ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <Money value={o.total} />
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone={orderStageTone(o.stage)} mono>
                      {statusLabel(o.stage)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Icon name="chevronRight" className="size-4 text-faint" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-muted">No policies match this filter.</p>
        )}
      </Card>
    </div>
  );
}
