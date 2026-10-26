import { endOfDay } from "date-fns";
import { PageHeader } from "@/components/ui";
import { VisitTable } from "@/components/visit-table";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visitInclude, visitWhereFor } from "@/lib/visits";

export default async function UpcomingPage() {
  const session = await requireSession();
  if (!session) return null;
  const visits = await prisma.visit.findMany({
    where: {
      AND: [
        visitWhereFor(session),
        { visitDate: { gt: endOfDay(new Date()) } },
        { status: { notIn: ["CANCELLED", "REJECTED"] } },
      ],
    },
    include: visitInclude,
    orderBy: { visitDate: "asc" },
  });

  return (
    <div>
      <PageHeader title="Upcoming visits" description="Approved and planned visits after today." />
      <VisitTable visits={visits} empty="No upcoming visits." />
    </div>
  );
}
