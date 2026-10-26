import { writeAudit } from "./audit";
import { notify } from "./notify";
import {
  isParkingSlot,
  parkingSlotMeta,
  remapLegacyParkingSlot,
  plateListLabel,
  requireParkingVehicles,
  vehiclesJson,
  type ParkingVehicle,
} from "./parking";
import { canAssignStaffParking, type SessionUser } from "./permissions";
import { prisma } from "./prisma";

export function parkingAssignedCopy(input: { name: string; slot: string; vehicles: ParkingVehicle[] }) {
  const meta = parkingSlotMeta(input.slot);
  const cars = input.vehicles.map((item) => (item.vehicleType ? `${item.plate} (${item.vehicleType})` : item.plate));
  return {
    title: "Parking bay reserved",
    message: [
      `Hello ${input.name},`,
      `Parking number ${meta.number} in Zone ${meta.zone} has been assigned by Human Resources.`,
      cars.length > 1 ? `Vehicle plates: ${cars.join(", ")}` : `Vehicle plate: ${cars[0] || ""}`,
      `This bay is now reserved for you.`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function listParkingStaff() {
  return prisma.user.findMany({
    where: { isActive: true, role: { notIn: ["SECURITY_GUARD", "SECURITY_SUPERVISOR"] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
  });
}

export async function listParkingAssignments() {
  return prisma.parkingAssignment.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, jobTitle: true, department: { select: { name: true } } } },
      assignedBy: { select: { id: true, name: true } },
    },
    orderBy: { slot: "asc" },
  });
}

export async function assignStaffParking(
  actor: SessionUser,
  slot: string,
  userId: string,
  vehicle: { plate?: string; vehicleType?: string | null; plates?: string[]; types?: Array<string | null | undefined> },
) {
  if (!canAssignStaffParking(actor.role)) throw new Error("Only Administration can assign parking.");
  const code = remapLegacyParkingSlot(slot);
  if (!isParkingSlot(code)) throw new Error("Choose a parking bay from Zone A, B, C, or D.");
  const vehicles = requireParkingVehicles(vehicle.plates?.length ? vehicle.plates : [vehicle.plate || ""], vehicle.types?.length ? vehicle.types : [vehicle.vehicleType]);
  const plate = plateListLabel(vehicles);
  const vehicleType = vehicles.length === 1 ? vehicles[0].vehicleType : null;
  const holder = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isActive: true, role: true },
  });
  if (!holder || !holder.isActive) throw new Error("Choose an employee from the list.");
  if (holder.role === "SECURITY_GUARD" || holder.role === "SECURITY_SUPERVISOR") {
    throw new Error("Choose an employee from the list.");
  }

  const taken = await prisma.parkingAssignment.findUnique({
    where: { slot: code },
    include: { user: { select: { id: true, name: true } } },
  });
  if (taken && taken.userId === holder.id) {
    const row = await prisma.parkingAssignment.update({
      where: { id: taken.id },
      data: { plate, vehicleType, vehicles: vehiclesJson(vehicles), assignedById: actor.id },
    });
    return { assignment: row, movedFrom: null };
  }
  if (taken) {
    await prisma.parkingAssignment.delete({ where: { id: taken.id } });
  }

  const previous = await prisma.parkingAssignment.findFirst({
    where: { userId: holder.id, NOT: { slot: code } },
  });
  if (previous) {
    await prisma.parkingAssignment.delete({ where: { id: previous.id } });
  }

  const row = await prisma.parkingAssignment.create({
    data: { slot: code, userId: holder.id, assignedById: actor.id, plate, vehicleType, vehicles: vehiclesJson(vehicles) },
  });

  await writeAudit({
    userId: actor.id,
    action: "Parking assigned",
    module: "Assign parking",
    previousValue: previous ? { slot: previous.slot, userId: holder.id } : taken ? { slot: code, userId: taken.userId } : null,
    newValue: { slot: code, userId: holder.id, name: holder.name, plate, vehicles },
  });

  const copy = parkingAssignedCopy({ name: holder.name, slot: code, vehicles });
  await notify({
    userId: holder.id,
    type: "PARKING_ASSIGNED",
    title: copy.title,
    message: copy.message,
    onBehalfOf: holder.name,
  });

  return { assignment: row, movedFrom: previous?.slot || null };
}

export async function releaseStaffParking(actor: SessionUser, slot: string) {
  if (!canAssignStaffParking(actor.role)) throw new Error("Only Administration can assign parking.");
  const code = remapLegacyParkingSlot(slot);
  const row = await prisma.parkingAssignment.findUnique({
    where: { slot: code },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!row) throw new Error("This bay is already free.");
  await prisma.parkingAssignment.delete({ where: { id: row.id } });
  await writeAudit({
    userId: actor.id,
    action: "Parking released",
    module: "Assign parking",
    previousValue: { slot: code, userId: row.userId, name: row.user.name },
  });
  return row;
}
