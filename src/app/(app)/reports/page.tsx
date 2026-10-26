import { AreaChart, ColumnChart, DonutChart, HBars, series } from "@/components/charts";
import { FrequentList } from "@/components/paged-tables";
import { Button, Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { analytics } from "@/lib/queries";
import { typeLabel } from "@/lib/format";

export default async function ReportsPage() {
  const session = await requireSession();
  if (!session) return null;
  const data = await analytics(session);
  const days = series(data.byDay).sort((a, b) => a.label.localeCompare(b.label)).map((row) => ({
    ...row,
    label: row.label.slice(5),
  }));
  const hours = series(data.byHour).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        description="Department load, visit mix, duration, and approval outcomes."
        actions={<Button href="/api/reports/export" variant="secondary">Export CSV</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card tone="mint">
          <div className="text-[12px] text-[var(--muted)]">Walk-in vs planned</div>
          <div className="mt-2 text-sm">{data.walkIn} walk-in · {data.planned} planned</div>
        </Card>
        <Card tone="sage">
          <div className="text-[12px] text-[var(--muted)]">Approval / rejection</div>
          <div className="mt-2 text-sm">{data.approved} approved · {data.rejected} rejected</div>
        </Card>
        <Card tone="sky">
          <div className="text-[12px] text-[var(--muted)]">Average visit duration</div>
          <div className="kpi-value mt-1">
            {data.avgDuration}
            <span className="text-sm font-normal text-[var(--muted)]"> min</span>
          </div>
        </Card>
        <Card tone="sand">
          <div className="text-[12px] text-[var(--muted)]">Most visited</div>
          <div className="mt-2 text-sm">{data.mostVisited[0]?.[0] ?? "—"}</div>
        </Card>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <Card tone="mint">
          <h2 className="mb-3 text-sm font-medium">Walk-in vs planned</h2>
          <DonutChart
            items={[
              { label: "Planned", value: data.planned, color: "#7eb8b3" },
              { label: "Walk-in", value: data.walkIn, color: "#d2c089" },
            ]}
          />
        </Card>
        <Card tone="peach">
          <h2 className="mb-3 text-sm font-medium">Approvals</h2>
          <DonutChart
            items={[
              { label: "Approved", value: data.approved, color: "#8fbf9a" },
              { label: "Rejected", value: data.rejected, color: "#d2a898" },
            ]}
          />
        </Card>
        <Card tone="sky">
          <h2 className="mb-2 text-sm font-medium">Visits by day</h2>
          <AreaChart items={days} />
        </Card>
      </div>

      <Card tone="lilac" className="mb-4">
        <h2 className="mb-3 text-sm font-medium">Peak visiting hours</h2>
        <ColumnChart items={hours} height={168} />
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card tone="sand">
          <h2 className="mb-3 text-sm font-medium">Visitors by department</h2>
          <HBars data={data.byDepartment} />
        </Card>
        <Card tone="sage">
          <h2 className="mb-3 text-sm font-medium">Visitors by visit type</h2>
          <HBars data={data.byType} mapLabel={typeLabel} />
        </Card>
        <Card tone="sky">
          <h2 className="mb-3 text-sm font-medium">Visitors by company</h2>
          <HBars data={data.byCompany} />
        </Card>
        <Card tone="mint">
          <h2 className="mb-3 text-sm font-medium">Frequent visitors</h2>
          <FrequentList visitors={data.frequent} />
        </Card>
      </div>
    </div>
  );
}
