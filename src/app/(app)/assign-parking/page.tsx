import { redirect } from "next/navigation";
import { ParkingAssignMap } from "@/components/parking-assign-map";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listParkingAssignments, listParkingStaff } from "@/lib/parking-assign";
import { parkingVehiclesFromStored } from "@/lib/parking";
import { canAssignStaffParking } from "@/lib/permissions";

export default async function AssignParkingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; assigned?: string; released?: string; moved?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canAssignStaffParking(session.role)) redirect("/dashboard");
  const query = await searchParams;
  const [staff, assignments] = await Promise.all([listParkingStaff(), listParkingAssignments()]);

  return (
    <div>
      <PageHeader
        title="Assign parking"
        description="Four HQ zones in one sequence: A25–A42, B43–B60, C61–C78, D79–D96. Click a bay to reserve it for an employee. They get a Teams notice from Human Resources."
      />
      {query.error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.error}
        </p>
      ) : null}
      {query.assigned ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          {query.assigned} is reserved
          {query.moved ? `. Previous bay ${query.moved} was released.` : "."}
        </p>
      ) : null}
      {query.released ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          {query.released} is free again.
        </p>
      ) : null}
      <ParkingAssignMap
        employees={staff.map((person) => ({
          value: person.id,
          label: person.name,
          hint: [person.department?.name, person.jobTitle].filter(Boolean).join(" · "),
        }))}
        assignments={assignments.map((row) => ({
          slot: row.slot,
          userId: row.user.id,
          name: row.user.name,
          email: row.user.email,
          jobTitle: row.user.jobTitle,
          department: row.user.department?.name || null,
          assignedBy: row.assignedBy.name,
          vehicles: parkingVehiclesFromStored(row),
        }))}
      />
    </div>
  );
}
