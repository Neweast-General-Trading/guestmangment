import { emailCandidates } from "./intranet-sso";
import { parkingSlotMeta, parkingVehiclesFromStored, type ParkingVehicle } from "./parking";
import { prisma } from "./prisma";

export type IntranetParkingQuery = {
  email?: string | null;
  empId?: string | null;
};

export type IntranetParkingView =
  | { assigned: false }
  | {
      assigned: true;
      name: string;
      slot: string;
      zone: string;
      number: number;
      section: number;
      vehicles: ParkingVehicle[];
      label: string;
      message: string;
    };

export function readIntranetParkingQuery(input: Record<string, unknown>): IntranetParkingQuery {
  const email = String(input.email ?? input.mail ?? input.userEmail ?? "").trim();
  const empId = String(input.empId ?? input.payrollNo ?? input.empID ?? "").trim();
  return {
    email: email || null,
    empId: empId || null,
  };
}

export function intranetParkingView(input: {
  name: string;
  slot: string;
  plate?: string;
  vehicleType?: string | null;
  vehicles?: string | null;
}): Extract<IntranetParkingView, { assigned: true }> {
  const meta = parkingSlotMeta(input.slot);
  const vehicles = parkingVehiclesFromStored(input);
  return {
    assigned: true,
    name: input.name,
    slot: input.slot,
    zone: meta.zone,
    number: meta.number,
    section: meta.section,
    vehicles,
    label: `Parking number ${meta.number} in Zone ${meta.zone}`,
    message: `Your parking bay is number ${meta.number} in Zone ${meta.zone}.`,
  };
}

export async function findIntranetParking(query: IntranetParkingQuery): Promise<IntranetParkingView> {
  const emails = query.email ? emailCandidates(query.email) : [];
  const empId = query.empId?.trim() || "";
  const user =
    (emails.length
      ? await prisma.user.findFirst({
          where: { isActive: true, email: { in: emails } },
          select: { id: true, name: true },
        })
      : null) ||
    (empId
      ? await prisma.user.findFirst({
          where: { isActive: true, payrollNo: empId },
          select: { id: true, name: true },
        })
      : null);
  if (!user) return { assigned: false };
  const row = await prisma.parkingAssignment.findFirst({ where: { userId: user.id } });
  if (!row) return { assigned: false };
  return intranetParkingView({
    name: user.name,
    slot: row.slot,
    plate: row.plate,
    vehicleType: row.vehicleType,
    vehicles: row.vehicles,
  });
}
