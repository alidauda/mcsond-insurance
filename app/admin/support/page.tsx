import { Button, PageHeading } from "@/components/ui";
import { getSupportQueue, getSupportQueueStats } from "@/lib/support";
import { SupportQueueTable } from "./SupportQueueTable";

export default async function AdminSupportPage() {
  const [supportQueue, stats] = await Promise.all([
    getSupportQueue(),
    getSupportQueueStats(),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow={`Support inbox · ${stats.open} open`}
        title={
          <>
            The <em className="italic text-crimson">queue.</em>
          </>
        }
        actions={
          <>
            {stats.filters.map((f) => (
              <Button key={f.key} variant="outline" className="px-4 py-2.5">
                {f.label} ({f.count})
              </Button>
            ))}
          </>
        }
      />

      <SupportQueueTable queue={supportQueue} />
    </div>
  );
}
