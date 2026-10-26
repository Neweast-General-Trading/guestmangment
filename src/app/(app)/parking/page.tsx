import { PageHeader } from "@/components/ui";
import { ParkingTable } from "@/components/paged-tables";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ParkingPage() {
  await requireSession();
  const vehicles = await prisma.vehicle.findMany({
    include: {
      visit: { include: { host: true, visitors: { include: { visitor: true } } } },
    },
    orderBy: { id: "desc" },
  });

  return (
    <div>
      <PageHeader title="Parking / Vehicles" description="Visitor vehicles and assigned parking slots." />
      <ParkingTable vehicles={vehicles} />
    </div>
  );
}
