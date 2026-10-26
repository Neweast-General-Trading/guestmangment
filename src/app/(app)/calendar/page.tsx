import { format } from "date-fns";
import { PageHeader } from "@/components/ui";
import { VisitCalendar } from "@/components/calendar";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visitWhereFor } from "@/lib/visits";

export default async function CalendarPage() {
  const session = await requireSession();
  if (!session) return null;
  const visits = await prisma.visit.findMany({
    where: {
      AND: [visitWhereFor(session), { status: { notIn: ["CANCELLED", "REJECTED", "DRAFT"] } }],
    },
    include: { visitors: { include: { visitor: true }, where: { isPrimary: true } } },
    orderBy: { expectedArrival: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Visit calendar"
        description="Month view of expected, approved, and on-site visits. Colored by visit type."
      />
      <VisitCalendar
        visits={visits.map((visit) => ({
          id: visit.id,
          visitCode: visit.visitCode,
          name: visit.visitors[0]?.visitor.fullName ?? visit.visitCode,
          type: visit.type,
          status: visit.status,
          date: visit.visitDate.toISOString(),
          time: format(visit.expectedArrival, "HH:mm"),
          fromAbroad: visit.fromAbroad,
          hotelRequired: visit.hotelRequired,
          pickupRequired: visit.pickupRequired,
        }))}
      />
    </div>
  );
}
