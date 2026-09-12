"use client";

import { useRouter } from "next/navigation";
import { Avatar, Badge, Card } from "@/components/ui";
import { ProgressBar } from "@/components/charts";
import type { QueueTicket } from "@/lib/mock-data";

export function SupportQueueTable({ queue }: { queue: QueueTicket[] }) {
  const router = useRouter();
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-xs uppercase tracking-[0.14em] text-muted">
              <th className="px-6 py-4 font-medium">Ticket</th>
              <th className="px-6 py-4 font-medium">Subject</th>
              <th className="px-6 py-4 font-medium">User</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Priority</th>
              <th className="px-6 py-4 font-medium">Assigned</th>
              <th className="px-6 py-4 font-medium">SLA</th>
              <th className="px-6 py-4 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((t) => {
              const atRisk = t.sla > 0.7;
              return (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/admin/support/${t.id}`)}
                  className="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-canvas/60"
                >
                  <td className="px-6 py-4 font-mono text-xs text-ink-soft">{t.id}</td>
                  <td className="px-6 py-4 font-semibold text-ink hover:text-navy">{t.subject}</td>
                  <td className="px-6 py-4 text-ink-soft">{t.user}</td>
                  <td className="px-6 py-4">
                    <Badge tone="neutral" dot mono>
                      {t.type}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone={t.priority === "High" ? "danger" : "neutral"} dot>
                      {t.priority}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={t.assignedInitials} className="size-7 text-[0.65rem]" />
                      <span className="text-ink-soft">{t.assigned}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <ProgressBar
                      value={t.sla * 100}
                      color={atRisk ? "var(--color-crimson)" : "var(--color-navy)"}
                      className="w-24"
                    />
                  </td>
                  <td className="px-6 py-4 text-muted">{t.updated}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
