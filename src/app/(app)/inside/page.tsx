import { PageHeader } from "@/components/ui";
import { InsideTable } from "@/components/paged-tables";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visitInclude, visitWhereFor } from "@/lib/visits";

export default async function InsidePage() {
  const session = await requireSession();
  if (!session) return null;
  const visits = await prisma.visit.findMany({
    where: {
      AND: [visitWhereFor(session), { status: { in: ["CHECKED_IN", "CURRENTLY_INSIDE", "IN_MEETING", "OVERDUE"] } }],
    },
    include: visitInclude,
    orderBy: { checkInAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Currently inside Headquarters"
        description="Live occupancy for reception, security, and emergency evacuation."
      />
      <InsideTable visits={visits} />
    </div>
  );
}
