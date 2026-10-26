import { updateServiceTaskAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { HospitalityList, ServiceTaskList } from "@/components/paged-tables";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visitWhereFor } from "@/lib/visits";
import { mealSummary } from "@/lib/hospitality";
import { HOTEL_STATUSES, PICKUP_TYPES } from "@/lib/hospitality";
import { checkInModeLabel, needLabel, selectedFromVisit } from "@/lib/guest-needs";
import { listActiveServices } from "@/lib/service-master";

export default async function ServiceTasksPage() {
  const session = await requireSession();
  if (!session) return null;
  const isAdmin = session.role === "SYSTEM_ADMIN";
  const catalog = await listActiveServices();
  const catalogLabel = Object.fromEntries(catalog.map((item) => [item.code, item.label]));
  const [tasks, visits] = await Promise.all([
    prisma.visitServiceTask.findMany({
      where: isAdmin ? {} : { service: { owners: { some: { userId: session.id } } } },
      include: {
        service: true,
        visit: {
          include: {
            host: true,
            visitors: { include: { visitor: true }, where: { isPrimary: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.visit.findMany({
      where: {
        AND: [
          visitWhereFor(session),
          {
            OR: [
              { fromAbroad: true },
              { oneTimeVisit: true },
              { hotelRequired: true },
              { pickupRequired: true },
              { mealBreakfast: true },
              { mealLunch: true },
              { mealDinner: true },
              { AND: [{ guestNeedsJson: { not: null } }, { NOT: { guestNeedsJson: "[]" } }] },
            ],
            status: { notIn: ["CANCELLED", "REJECTED"] },
          },
        ],
      },
      include: {
        host: true,
        department: true,
        visitors: { include: { visitor: true }, where: { isPrimary: true } },
      },
      orderBy: { visitDate: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Services & Hospitality"
        description="Service tasks after approval, and guest stay / travel needs."
      />
      <div className="space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-bold">Services</h2>
          <ServiceTaskList tasks={tasks} onUpdate={updateServiceTaskAction} />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-bold">Hospitality</h2>
          <HospitalityList
            visits={visits.map((visit) => {
              const hotel = HOTEL_STATUSES.find((item) => item.code === visit.hotelBookingStatus)?.label;
              const pickup = PICKUP_TYPES.find((item) => item.code === visit.pickupType)?.label;
              const pills = [
                visit.fromAbroad ? "From abroad" : "",
                visit.oneTimeVisit ? "One-time" : "",
                checkInModeLabel(visit.qrCheckInRequired),
                visit.hotelRequired ? `Hotel${hotel ? ` · ${hotel}` : ""}${visit.hotelName ? ` · ${visit.hotelName}` : ""}` : "",
                visit.pickupRequired ? `Pickup${pickup ? ` · ${pickup}` : ""}` : "",
                visit.dropoffRequired ? "Drop-off" : "",
                visit.mealBreakfast || visit.mealLunch || visit.mealDinner ? mealSummary(visit) : "",
                ...selectedFromVisit(visit)
                  .filter((item) => !["HOTEL", "AIRPORT_PICKUP", "AIRPORT_DROPOFF", "BREAKFAST", "LUNCH", "DINNER"].includes(item.code))
                  .map((item) => catalogLabel[item.code] || needLabel(item.code)),
              ].filter(Boolean);
              return { ...visit, pills };
            })}
          />
        </section>
      </div>
    </div>
  );
}
