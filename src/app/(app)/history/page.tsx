import { PageHeader } from "@/components/ui";
import { VisitFilters } from "@/components/filters";
import { VisitTable } from "@/components/visit-table";
import { requireSession } from "@/lib/auth";
import { lookups, searchVisits } from "@/lib/queries";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  if (!session) return null;
  const params = await searchParams;
  const [{ departments }, visits] = await Promise.all([
    lookups(),
    searchVisits(session, { ...params, take: 120 }),
  ]);

  return (
    <div>
      <PageHeader title="Visit history" description="Search previous visitors by person, host, department, purpose, or visit ID." />
      <VisitFilters departments={departments} defaults={params} />
      <VisitTable visits={visits} />
    </div>
  );
}
