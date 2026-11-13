import { requestNow } from "@/lib/visit-order";
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
    searchVisits(session, { ...params, take: 120, order: "newest", scope: "history" }),
  ]);

  return (
    <div>
      <PageHeader
        title="Visit history"
        description="Visits that are over: passed, finished, cancelled or rejected. Newest first, grouped by day."
      />
      <VisitFilters departments={departments} defaults={params} />
      <VisitTable visits={visits} now={requestNow()} empty="No past visits yet." />
    </div>
  );
}
