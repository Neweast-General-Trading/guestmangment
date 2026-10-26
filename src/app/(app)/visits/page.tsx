import { Plus } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { VisitFilters } from "@/components/filters";
import { VisitTable } from "@/components/visit-table";
import { requireSession } from "@/lib/auth";
import { lookups, searchVisits } from "@/lib/queries";

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  if (!session) return null;
  const params = await searchParams;
  const [{ departments }, visits] = await Promise.all([
    lookups(),
    searchVisits(session, params),
  ]);

  return (
    <div>
      <PageHeader
        title="Visit requests"
        description="Create, track, and update visits across the Headquarters lifecycle."
        actions={
          <>
            <Button href="/directory" variant="secondary">
              Directory
            </Button>
            <Button href="/visits/new">
              <Plus size={14} strokeWidth={2} />
              Visit request
            </Button>
          </>
        }
      />
      {params.saved ? (
        <p className="mb-3 rounded-md border border-[#cfe6d6] bg-[#eef7f2] px-3 py-2 text-[13px] text-[#1f7a4d]">
          Visit {params.saved} was added and the list is up to date.
        </p>
      ) : null}
      <VisitFilters departments={departments} defaults={params} />
      <VisitTable visits={visits} />
    </div>
  );
}
