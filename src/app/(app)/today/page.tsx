import { endOfDay, startOfDay } from "date-fns";
import { PageHeader } from "@/components/ui";
import { VisitTable } from "@/components/visit-table";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visitInclude, visitWhereFor } from "@/lib/visits";

export default async function TodayPage() {
  const session = await requireSession();
  if (!session) return null;
  const visits = await prisma.visit.findMany({
    where: {
      AND: [visitWhereFor(session), { visitDate: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } }],
    },
    include: visitInclude,
    orderBy: { expectedArrival: "asc" },
  });

  return (
    <div>
      <PageHeader title="Today's visitors" description="Every visit scheduled for Headquarters today." />
      <VisitTable visits={visits} empty="No visitors scheduled today." />
    </div>
  );
}
