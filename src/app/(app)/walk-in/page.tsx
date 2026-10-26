import { PageHeader } from "@/components/ui";
import { VisitForm } from "@/components/visit-form";
import { VisitTable } from "@/components/visit-table";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { meetingRoomOptions } from "@/lib/graph";
import { lookups } from "@/lib/queries";
import { visitInclude, visitWhereFor } from "@/lib/visits";
import { canOperateGate } from "@/lib/permissions";

export default async function WalkInPage() {
  const session = await requireSession();
  if (!session) return null;
  const [{ hosts, departments, catalog }, rooms] = await Promise.all([lookups(), meetingRoomOptions()]);
  const visits = await prisma.visit.findMany({
    where: { AND: [visitWhereFor(session), { type: "WALK_IN" }] },
    include: visitInclude,
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div>
      <PageHeader
        title="Walk-in visitors"
        description="Register a visitor without an appointment. Security sends an approval request before check-in."
      />
      {canOperateGate(session.role) || session.role === "HR_ADMIN" ? (
        <div className="mb-8">
          <VisitForm hosts={hosts} departments={departments} currentUserId={session.id} mode="walkin" catalog={catalog} rooms={rooms} />
        </div>
      ) : null}
      <h2 className="mb-3 text-sm font-medium">Walk-in history</h2>
      <VisitTable visits={visits} empty="No walk-in visits yet." />
    </div>
  );
}
