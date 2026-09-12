import { PageHeading, Card, Badge, Button, Divider } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getReports } from "@/lib/settings";

export default async function AdminReportsPage() {
  const reports = await getReports();
  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        eyebrow="Reports"
        title={
          <>
            Pull the <em className="italic text-crimson">numbers.</em>
          </>
        }
        actions={
          <Button variant="primary" icon="plus">
            Custom report
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.name} className="flex flex-col p-6">
            {/* top row · icon tile + cadence badge */}
            <div className="flex items-start justify-between">
              <span className="inline-grid size-11 place-items-center rounded-[12px] bg-navy/5 text-navy">
                <Icon name="barChart" className="size-5" />
              </span>
              <Badge tone="neutral" mono>
                {report.cadence}
              </Badge>
            </div>

            {/* title + description */}
            <h2 className="mt-5 font-serif text-lg font-semibold text-navy">{report.name}</h2>
            <p className="mt-1.5 text-sm text-muted">{report.desc}</p>

            <Divider className="my-5" />

            {/* footer · last run + run button */}
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-muted">Last run: {report.lastRun}</p>
              <Button variant="outline" icon="download" className="px-4 py-2 text-xs">
                Run
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
