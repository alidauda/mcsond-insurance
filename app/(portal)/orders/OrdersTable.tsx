"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Money, IconButton, statusTone, statusLabel } from "@/components/ui";
import { Tabs } from "@/components/Interactive";
import type { Order } from "@/lib/mock-data";

export function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [active, setActive] = useState("all");

  // Counts come straight off the rows, so tabs always agree with the table.
  const live = orders.filter((o) => o.status === "active" || o.status === "renew");
  const renewing = orders.filter((o) => o.status === "renew");
  const refunded = orders.filter((o) => o.status === "cancelled");
  const tabs = [
    { key: "all", label: "All", count: orders.length },
    { key: "active", label: "Active", count: live.length },
    { key: "renew", label: "Renewing soon", count: renewing.length },
    { key: "refunded", label: "Refunded", count: refunded.length },
  ];

  const rows =
    active === "all" ? orders : active === "active" ? live : active === "renew" ? renewing : refunded;

  return (
    <>
      <Tabs items={tabs} value={active} onChange={setActive} />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
                <th className="px-6 py-4 font-medium">Policy</th>
                <th className="px-6 py-4 font-medium">Bound</th>
                <th className="px-6 py-4 font-medium">Cover</th>
                <th className="px-6 py-4 font-medium">Qty</th>
                <th className="px-6 py-4 text-right font-medium">Total</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-muted">
                    {active === "refunded"
                      ? "No refunded policies to show."
                      : active === "renew"
                        ? "Nothing due for renewal."
                        : "No policies yet."}
                  </td>
                </tr>
              ) : (
                rows.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/orders/${o.id}`)}
                    className="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-canvas/60"
                  >
                    <td className="px-6 py-5 font-mono text-[0.8rem] text-ink-soft">{o.id}</td>
                    <td className="px-6 py-5 text-ink-soft">{o.date}</td>
                    <td className="px-6 py-5 text-ink">{o.item}</td>
                    <td className="px-6 py-5 text-ink-soft">{o.qty}</td>
                    <td className="px-6 py-5 text-right">
                      <Money value={o.total} />
                    </td>
                    <td className="px-6 py-5">
                      <Badge tone={statusTone(o.status)} mono>
                        {statusLabel(o.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <IconButton name="dots" label="More" className="border-0 bg-transparent" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
