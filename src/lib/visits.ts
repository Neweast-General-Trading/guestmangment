import { differenceInMinutes, endOfDay, startOfDay } from "date-fns";
import { prisma } from "./prisma";
import { assertFutureVisit, combineVisitDateTime } from "./visit-schedule";
import { addTimeline, writeAudit } from "./audit";
import { notify, notifyRoles } from "./notify";
import { startApprovals } from "./approvals";
import { makeQrToken, nextBadgeNumber, nextVisitCode } from "./ids";
import { sendVisitInvitationEmail } from "./mail";
import { isParkingSlot, remapLegacyParkingSlot } from "./parking";
import { canAssignParking, canOperateGate, canSeeAllVisits, canSeeIdentity, isInside, type SessionUser } from "./permissions";
import { parseQrPayload } from "./qr";
import { hospitalityData, type HospitalityInput } from "./hospitality";
import { flagsFromNeeds, parseGuestNeeds } from "./guest-needs";
import { releaseOutlookRoom, syncOutlookRoom } from "./room-booking";
import type { Prisma } from "@prisma/client";

export const visitInclude = {
  host: { include: { department: true } },
  createdBy: true,
  department: true,
  checkInBy: true,
  checkOutBy: true,
  visitors: { include: { visitor: true }, orderBy: { isPrimary: "desc" as const } },
  vehicles: true,
  approvals: { include: { assignee: { include: { department: true } } }, orderBy: { stepOrder: "asc" as const } },
  timeline: { orderBy: { createdAt: "asc" as const } },
  badges: { orderBy: { issuedAt: "desc" as const } },
  serviceTasks: {
    include: {
      service: { include: { owners: { include: { user: true } } } },
      updates: { include: { user: true }, orderBy: { createdAt: "desc" as const } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.VisitInclude;

export type FullVisit = Prisma.VisitGetPayload<{ include: typeof visitInclude }>;

export function primaryVisitor(visit: FullVisit) {
  return visit.visitors[0]?.visitor ?? null;
}

export function sanitizeVisit(visit: FullVisit, role: SessionUser["role"]) {
  if (canSeeIdentity(role)) return visit;
  return {
    ...visit,
    visitors: visit.visitors.map((link) => ({
      ...link,
      visitor: { ...link.visitor, idReference: link.visitor.idReference ? "restricted" : null },
    })),
    internalNotes: role === "SECURITY_GUARD" ? null : visit.internalNotes,
  };
}

export function visitWhereFor(user: SessionUser): Prisma.VisitWhereInput {
  if (canSeeAllVisits(user.role)) return {};
  if (user.role === "DEPARTMENT_MANAGER" && user.departmentId) {
    return {
      OR: [{ hostId: user.id }, { createdById: user.id }, { departmentId: user.departmentId }],
    };
  }
  return { OR: [{ hostId: user.id }, { createdById: user.id }] };
}

export type VisitorInput = {
  fullName: string;
  mobile: string;
  email?: string;
  nationality?: string;
  company?: string;
  jobTitle?: string;
  visitorType: string;
  idType?: string;
  idReference?: string;
};

export type VisitDraft = {
  type: string;
  purpose: string;
  description?: string;
  visitDate: string;
  expectedArrival: string;
  expectedDeparture?: string;
  hostId?: string;
  departmentId: string;
  location?: string;
  meetingRoom?: string;
  parkingRequired?: boolean;
  specialRequirements?: string;
  internalNotes?: string;
  vip?: boolean;
  accessArea?: string;
  visitors: VisitorInput[];
  vehiclePlate?: string;
  vehicleType?: string;
  parkingSlot?: string;
  submit?: boolean;
  hospitality?: HospitalityInput;
};

export async function upsertVisitor(input: VisitorInput) {
  const mobile = input.mobile.trim();
  const existing = await prisma.visitor.findFirst({ where: { mobile } });
  const data = {
    fullName: input.fullName.trim(),
    mobile,
    email: input.email?.trim() || null,
    nationality: input.nationality?.trim() || null,
    company: input.company?.trim() || null,
    jobTitle: input.jobTitle?.trim() || null,
    visitorType: input.visitorType,
    idType: input.idType || null,
    idReference: input.idReference?.trim() || null,
  };
  if (existing) {
    return prisma.visitor.update({ where: { id: existing.id }, data });
  }
  return prisma.visitor.create({ data });
}

function vehicleWrite(input: { vehiclePlate?: string; vehicleType?: string; parkingSlot?: string }) {
  const plate = input.vehiclePlate?.trim().toUpperCase() || "";
  const slot = remapLegacyParkingSlot(input.parkingSlot || "");
  if (slot && !isParkingSlot(slot)) throw new Error("Choose a parking slot from Zone A, B, C, or D.");
  if (!plate && !slot) return undefined;
  return {
    create: {
      plate: plate || "UNPLATED",
      vehicleType: input.vehicleType?.trim() || null,
      parkingSlot: slot || null,
    },
  };
}

async function writeParkingSlot(visitId: string, slot: string, actorId?: string) {
  const value = remapLegacyParkingSlot(slot);
  if (!value) return;
  if (!isParkingSlot(value)) throw new Error("Choose a parking slot from Zone A, B, C, or D.");
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { vehicles: true },
  });
  if (visit.vehicles[0]) {
    await prisma.vehicle.update({
      where: { id: visit.vehicles[0].id },
      data: { parkingSlot: value },
    });
  } else {
    await prisma.vehicle.create({
      data: { visitId, plate: "UNPLATED", parkingSlot: value },
    });
  }
  await prisma.visit.update({ where: { id: visitId }, data: { parkingRequired: true } });
  if (actorId) {
    await addTimeline({ visitId, event: "Parking assigned", note: value, userId: actorId });
  }
}

export async function assignParkingSlot(actor: SessionUser, visitId: string, slot: string) {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    select: { hostId: true },
  });
  if (!canAssignParking(actor.role, { actorId: actor.id, hostId: visit.hostId })) {
    throw new Error("You cannot assign a parking slot on this visit.");
  }
  if (!slot.trim()) throw new Error("Parking slot is required.");
  await writeParkingSlot(visitId, slot, actor.id);
}

function combineDate(date: string, time?: string) {
  return combineVisitDateTime(date, time);
}

export async function createVisit(actor: SessionUser, input: VisitDraft) {
  if (!input.purpose || input.purpose.trim().length < 8) {
    throw new Error("Purpose of visit must be descriptive (at least 8 characters).");
  }
  if (!input.visitors.length) throw new Error("At least one visitor is required.");

  assertFutureVisit(input.visitDate, input.expectedArrival);
  const hostId = input.hostId || actor.id;
  const visitCode = await nextVisitCode();
  const visitDate = new Date(`${input.visitDate}T00:00:00`);
  const expectedArrival = combineDate(input.visitDate, input.expectedArrival);
  const expectedDeparture = input.expectedDeparture
    ? combineDate(input.visitDate, input.expectedDeparture)
    : null;

  const visitors = await Promise.all(input.visitors.map(upsertVisitor));
  const restricted = visitors.find((visitor) => visitor.restricted);
  const hosp = hospitalityData(input.hospitality ?? {});

  const visit = await prisma.visit.create({
    data: {
      visitCode,
      type: input.type,
      status: input.submit ? "PENDING_APPROVAL" : "DRAFT",
      purpose: input.purpose.trim(),
      description: input.description?.trim() || null,
      visitDate,
      expectedArrival,
      expectedDeparture,
      hostId,
      departmentId: input.departmentId,
      location: input.location || null,
      meetingRoom: input.meetingRoom || null,
      visitorCount: visitors.length,
      specialRequirements: input.specialRequirements?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null,
      vip: Boolean(input.vip) || input.type === "VIP",
      accessArea: input.accessArea || "General Offices",
      qrToken: makeQrToken(),
      createdById: actor.id,
      ...hosp,
      parkingRequired: Boolean(input.parkingRequired) || flagsFromNeeds(parseGuestNeeds(hosp.guestNeedsJson)).parkingRequired,
      visitors: {
        create: visitors.map((visitor, index) => ({
          visitorId: visitor.id,
          isPrimary: index === 0,
        })),
      },
      vehicles: vehicleWrite(input),
    },
  });

  await addTimeline({ visitId: visit.id, event: "Visit created", userId: actor.id });
  await writeAudit({
    userId: actor.id,
    visitId: visit.id,
    action: "Visit created",
    module: "Visit Requests",
    newValue: { visitCode, type: input.type },
  });
  await notify({
    userId: hostId,
    visitId: visit.id,
    type: "VISIT_CREATED",
    title: "Visit created",
    message: `${visitCode} was created for ${visitors[0].fullName}.`,
  });

  if (restricted) {
    await addTimeline({
      visitId: visit.id,
      event: "Restricted visitor flagged",
      note: restricted.restrictionNote || restricted.fullName,
      userId: actor.id,
    });
  }

  if (input.meetingRoom) {
    await syncOutlookRoom(visit.id, input.meetingRoom);
  }

  if (input.submit) {
    await startApprovals(visit.id, actor.id);
  }

  return visit;
}

export async function updateVisit(actor: SessionUser, visitId: string, input: VisitDraft) {
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
  if (!["DRAFT", "PENDING_APPROVAL"].includes(visit.status)) {
    throw new Error("This visit can no longer be edited.");
  }
  if (visit.checkInAt) throw new Error("A visit cannot be changed after arrival.");
  if (!["HR_ADMIN", "SYSTEM_ADMIN"].includes(actor.role) && visit.createdById !== actor.id && visit.hostId !== actor.id) {
    throw new Error("You cannot edit this visit.");
  }

  assertFutureVisit(input.visitDate, input.expectedArrival);
  const visitors = await Promise.all(input.visitors.map(upsertVisitor));
  await prisma.visitVisitor.deleteMany({ where: { visitId } });
  await prisma.vehicle.deleteMany({ where: { visitId } });
  const hosp = hospitalityData(input.hospitality ?? {});

  const updated = await prisma.visit.update({
    where: { id: visitId },
    data: {
      type: input.type,
      purpose: input.purpose.trim(),
      description: input.description?.trim() || null,
      visitDate: new Date(`${input.visitDate}T00:00:00`),
      expectedArrival: combineDate(input.visitDate, input.expectedArrival),
      expectedDeparture: input.expectedDeparture
        ? combineDate(input.visitDate, input.expectedDeparture)
        : null,
      hostId: input.hostId || visit.hostId,
      departmentId: input.departmentId,
      location: input.location || null,
      meetingRoom: input.meetingRoom || null,
      visitorCount: visitors.length,
      specialRequirements: input.specialRequirements?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null,
      vip: Boolean(input.vip) || input.type === "VIP",
      accessArea: input.accessArea || visit.accessArea,
      ...hosp,
      parkingRequired: Boolean(input.parkingRequired) || flagsFromNeeds(parseGuestNeeds(hosp.guestNeedsJson)).parkingRequired,
      visitors: {
        create: visitors.map((visitor, index) => ({
          visitorId: visitor.id,
          isPrimary: index === 0,
        })),
      },
      vehicles: vehicleWrite(input),
    },
  });

  if (input.meetingRoom || updated.outlookEventId) {
    await syncOutlookRoom(visitId, input.meetingRoom);
  }

  await addTimeline({ visitId, event: "Visit updated", userId: actor.id });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: "Visit updated",
    module: "Visit Requests",
    previousValue: { status: visit.status, purpose: visit.purpose },
    newValue: { purpose: updated.purpose },
  });
  return updated;
}

export async function submitVisit(actor: SessionUser, visitId: string) {
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
  if (visit.status !== "DRAFT") throw new Error("Only draft visits can be submitted.");
  await prisma.visit.update({ where: { id: visitId }, data: { status: "PENDING_APPROVAL" } });
  await startApprovals(visitId, actor.id);
}

export async function cancelVisit(
  actor: SessionUser,
  visitId: string,
  reason: string,
  source: "HOST" | "ADMIN" | "VISITOR",
) {
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
  if (isInside(visit.status)) throw new Error("Check the visitor out before cancelling.");
  if (["COMPLETED", "CHECKED_OUT", "CANCELLED"].includes(visit.status)) {
    throw new Error("This visit is already closed.");
  }
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: "CANCELLED",
      cancelledBy: actor.id,
      cancelReason: reason,
      cancelSource: source,
    },
  });
  await releaseOutlookRoom(visitId);
  await addTimeline({ visitId, event: "Visit cancelled", note: `${source}: ${reason}`, userId: actor.id });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: "Visit cancelled",
    module: "Visit Requests",
    previousValue: visit.status,
    newValue: "CANCELLED",
  });
  await notify({
    userId: visit.hostId,
    visitId,
    type: "VISIT_CANCELLED",
    title: "Visit cancelled",
    message: `${visit.visitCode} was cancelled. ${reason}`,
  });
}

export async function sendInvitation(actor: SessionUser, visitId: string, channel: "EMAIL" | "WHATSAPP") {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { visitors: { include: { visitor: true } }, host: true, department: true },
  });
  if (visit.status !== "APPROVED" && visit.status !== "INVITATION_SENT" && visit.status !== "EXPECTED") {
    throw new Error("Invitations can only be sent after approval.");
  }

  if (channel === "EMAIL") {
    const settings = await prisma.systemSetting.findMany();
    const map = Object.fromEntries(settings.map((item) => [item.key, item.value]));
    const mailed = await sendVisitInvitationEmail({
      visitCode: visit.visitCode,
      qrToken: visit.qrToken,
      purpose: visit.purpose,
      visitDate: visit.visitDate,
      expectedArrival: visit.expectedArrival,
      meetingRoom: visit.meetingRoom,
      location: visit.location,
      hostName: visit.host.name,
      departmentName: visit.department.name,
      visitors: visit.visitors.map((link) => ({
        fullName: link.visitor.fullName,
        email: link.visitor.email,
      })),
      instructions: map.invite_instructions,
    });
    if (!mailed.ok) throw new Error(mailed.error);
  }

  const today = startOfDay(new Date());
  const status = visit.visitDate <= endOfDay(new Date()) && visit.visitDate >= today ? "EXPECTED" : "INVITATION_SENT";
  await prisma.visit.update({
    where: { id: visitId },
    data: { status, invitationSentAt: new Date(), invitationChannel: channel },
  });
  await addTimeline({
    visitId,
    event: "Invitation sent",
    note: channel === "EMAIL" ? "Invitation emailed to the visitor." : `Digital invitation sent via ${channel}.`,
    userId: actor.id,
  });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: "Invitation sent",
    module: "Invitations",
    newValue: { channel },
  });
  await notify({
    userId: visit.hostId,
    visitId,
    type: "INVITATION_SENT",
    title: "Invitation sent",
    message: `${visit.visitCode} invitation was sent via ${channel}.`,
  });
}

export function resolveQrGateAction(
  gate: "in" | "out",
  visit: { checkInAt: Date | null; checkOutAt: Date | null; status: string },
) {
  if (visit.checkOutAt || ["COMPLETED", "CHECKED_OUT"].includes(visit.status)) {
    return { error: "Visitor already checked out." };
  }
  if (gate === "out") {
    if (!visit.checkInAt) return { error: "Visitor is not inside. Use Check-in first." };
    return { action: "out" as const };
  }
  if (visit.checkInAt || isInside(visit.status)) {
    return { error: "Visitor is already inside. Switch to Check-out." };
  }
  return { action: "in" as const };
}

export async function processQrAtGate(
  actor: SessionUser,
  raw: string,
  gate: "in" | "out",
  extra?: { parkingSlot?: string },
) {
  if (!canOperateGate(actor.role)) {
    throw new Error("Only security can scan a visitor QR at the gate.");
  }
  const token = parseQrPayload(raw);
  if (!token) throw new Error("No QR code.");
  const visit = await prisma.visit.findUnique({
    where: { qrToken: token },
    include: { visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("This QR code does not match a visit.");
  if (!visit.qrCheckInRequired) {
    throw new Error("This visit is manual check-in. Open the visit and record entry or exit — do not scan the guest QR.");
  }
  const decision = resolveQrGateAction(gate, visit);
  if ("error" in decision) throw new Error(decision.error);

  if (decision.action === "out") {
    await checkOut(actor, visit.id, {
      exitGate: visit.entryGate || "Main Gate",
      badgeReturned: true,
      notes: "QR scan",
    });
    return { visitId: visit.id, action: "out" as const };
  }

  await checkIn(actor, visit.id, {
    entryGate: "Main Gate",
    notes: "QR scan",
    parkingSlot: extra?.parkingSlot,
  });
  return { visitId: visit.id, action: "in" as const };
}

export async function registerWalkIn(
  actor: SessionUser,
  input: VisitDraft & { requestApproval?: boolean },
) {
  const visit = await createVisit(actor, {
    ...input,
    type: "WALK_IN",
    submit: false,
  });
  await prisma.visit.update({
    where: { id: visit.id },
    data: { status: "WAITING_AT_GATE" },
  });
  await addTimeline({
    visitId: visit.id,
    event: "Waiting at gate",
    note: "Walk-in registered at security desk.",
    userId: actor.id,
  });
  if (input.requestApproval !== false) {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { status: "PENDING_APPROVAL" },
    });
    await startApprovals(visit.id, actor.id);
    await notifyRoles(["SECURITY_GUARD", "SECURITY_SUPERVISOR"], {
      visitId: visit.id,
      type: "VISITOR_WAITING_AT_GATE",
      title: "Walk-in waiting at gate",
      message: `${visit.visitCode} is waiting for host approval.`,
    });
  }
  return visit;
}

export async function verifyVisitor(actor: SessionUser, visitId: string) {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { visitors: { include: { visitor: true } } },
  });
  const restricted = visit.visitors.find((link) => link.visitor.restricted);
  if (restricted) {
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: "ACCESS_DENIED", verificationStatus: "DENIED" },
    });
    await addTimeline({
      visitId,
      event: "Access denied",
      note: restricted.visitor.restrictionNote || "Restricted visitor.",
      userId: actor.id,
    });
    throw new Error("Restricted visitor. Access is not authorized.");
  }
  if (!["APPROVED", "INVITATION_SENT", "EXPECTED", "ARRIVED", "WAITING_AT_GATE", "SECURITY_VERIFICATION"].includes(visit.status)) {
    if (visit.status !== "PENDING_APPROVAL") {
      throw new Error(`Visitor is not authorized for verification (${visit.status}).`);
    }
  }
  await prisma.visit.update({
    where: { id: visitId },
    data: { status: "SECURITY_VERIFICATION", verificationStatus: "VERIFIED" },
  });
  await addTimeline({ visitId, event: "Visitor verified", userId: actor.id });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: "Visitor verified",
    module: "Security Desk",
    newValue: "VERIFIED",
  });
}

export async function recordVisitVehicle(
  actor: SessionUser,
  visitId: string,
  input: { vehiclePlate?: string; vehicleType?: string; parkingSlot?: string },
) {
  if (!canOperateGate(actor.role) && actor.role !== "HR_ADMIN" && actor.role !== "SYSTEM_ADMIN") {
    throw new Error("You cannot update vehicle details.");
  }
  await writeVehicleDetails(visitId, input);
  const note = [input.vehiclePlate, input.vehicleType, input.parkingSlot].filter(Boolean).join(" · ");
  if (note) await addTimeline({ visitId, event: "Vehicle recorded", note, userId: actor.id });
}

async function writeVehicleDetails(
  visitId: string,
  input: { vehiclePlate?: string; vehicleType?: string; parkingSlot?: string },
) {
  const plate = input.vehiclePlate?.trim().toUpperCase() || "";
  const type = input.vehicleType?.trim() || "";
  const slot = remapLegacyParkingSlot(input.parkingSlot || "");
  if (slot && !isParkingSlot(slot)) throw new Error("Choose a parking slot from Zone A, B, C, or D.");
  if (!plate && !type && !slot) return;
  const existing = await prisma.vehicle.findFirst({ where: { visitId } });
  const data = {
    plate: plate || existing?.plate || "UNPLATED",
    vehicleType: type || existing?.vehicleType || null,
    parkingSlot: slot || existing?.parkingSlot || null,
  };
  if (existing) {
    await prisma.vehicle.update({ where: { id: existing.id }, data });
  } else {
    await prisma.vehicle.create({ data: { visitId, ...data } });
  }
  if (slot) await prisma.visit.update({ where: { id: visitId }, data: { parkingRequired: true } });
}

function parseClock(value?: string) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function checkIn(
  actor: SessionUser,
  visitId: string,
  input: {
    entryGate: string;
    notes?: string;
    badgeNumber?: string;
    parkingSlot?: string;
    vehiclePlate?: string;
    vehicleType?: string;
    checkInAt?: string;
  },
) {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { visitors: { include: { visitor: true } }, badges: true, vehicles: true },
  });

  if (visit.visitors.some((link) => link.visitor.restricted)) {
    throw new Error("Restricted visitor. Access is not authorized.");
  }
  if (!["APPROVED", "INVITATION_SENT", "EXPECTED", "ARRIVED", "SECURITY_VERIFICATION"].includes(visit.status)) {
    throw new Error("This visit is not approved for check-in.");
  }

  const badgeNumber = input.badgeNumber || (await nextBadgeNumber());
  await prisma.badge.create({
    data: { visitId, number: badgeNumber },
  });
  await writeVehicleDetails(visitId, {
    vehiclePlate: input.vehiclePlate,
    vehicleType: input.vehicleType,
    parkingSlot: input.parkingSlot,
  });

  await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: "CURRENTLY_INSIDE",
      checkInAt: parseClock(input.checkInAt) ?? new Date(),
      checkInById: actor.id,
      entryGate: input.entryGate,
      verificationStatus: visit.verificationStatus || "VERIFIED",
    },
  });

  await addTimeline({
    visitId,
    event: "Security check-in",
    note: `${input.entryGate}${input.notes ? ` · ${input.notes}` : ""}`,
    userId: actor.id,
  });
  await addTimeline({ visitId, event: "Badge issued", note: badgeNumber, userId: actor.id });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: "Security check-in",
    module: "Security Desk",
    newValue: { entryGate: input.entryGate, badgeNumber },
  });
  await notify({
    userId: visit.hostId,
    visitId,
    type: "VISITOR_CHECKED_IN",
    title: "Visitor checked in",
    message: "Your visitor has arrived and completed security check-in at the NEWEAST Headquarters.",
  });
}

export async function checkOut(
  actor: SessionUser,
  visitId: string,
  input: { exitGate: string; badgeReturned?: boolean; notes?: string; checkOutAt?: string },
) {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { badges: true },
  });
  if (!visit.checkInAt) throw new Error("Visitor has not checked in.");
  const checkOutAt = parseClock(input.checkOutAt) ?? new Date();
  const durationMinutes = differenceInMinutes(checkOutAt, visit.checkInAt);
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: "COMPLETED",
      checkOutAt,
      checkOutById: actor.id,
      exitGate: input.exitGate,
      badgeReturned: input.badgeReturned ?? true,
      durationMinutes,
    },
  });
  await prisma.badge.updateMany({
    where: { visitId, closed: false },
    data: { closed: true, returnedAt: new Date() },
  });
  await addTimeline({
    visitId,
    event: "Check-out",
    note: `${input.exitGate}${input.notes ? ` · ${input.notes}` : ""}`,
    userId: actor.id,
  });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: "Check-out",
    module: "Security Desk",
    newValue: { exitGate: input.exitGate, durationMinutes },
  });
  await notify({
    userId: visit.hostId,
    visitId,
    type: "VISITOR_CHECKED_OUT",
    title: "Visitor checked out",
    message: `${visit.visitCode} has left Headquarters. Duration ${durationMinutes} min.`,
  });
}

export async function markArrived(actor: SessionUser, visitId: string) {
  await prisma.visit.update({ where: { id: visitId }, data: { status: "ARRIVED" } });
  await addTimeline({ visitId, event: "Arrived", note: "Visitor reported at the gate.", userId: actor.id });
}

export async function markInMeeting(actor: SessionUser, visitId: string) {
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
  if (!isInside(visit.status)) throw new Error("Visitor is not inside.");
  await prisma.visit.update({ where: { id: visitId }, data: { status: "IN_MEETING" } });
  await addTimeline({ visitId, event: "In meeting", userId: actor.id });
}

export async function setVisitorRestricted(
  actor: SessionUser,
  visitorId: string,
  restricted: boolean,
  note?: string,
) {
  const visitor = await prisma.visitor.update({
    where: { id: visitorId },
    data: { restricted, restrictionNote: note || null },
  });
  await writeAudit({
    userId: actor.id,
    action: restricted ? "Visitor restricted" : "Visitor unrestricted",
    module: "Visitor Directory",
    newValue: { visitorId, restricted, note },
  });
  return visitor;
}

export function authorizationBanner(status: string) {
  if (["APPROVED", "INVITATION_SENT", "EXPECTED", "ARRIVED", "SECURITY_VERIFICATION"].includes(status)) {
    return { tone: "ok" as const, label: "APPROVED – READY FOR CHECK-IN" };
  }
  if (["PENDING_APPROVAL", "WAITING_AT_GATE"].includes(status)) {
    return { tone: "warn" as const, label: "PENDING APPROVAL – DO NOT ALLOW ENTRY" };
  }
  if (status === "CANCELLED") return { tone: "muted" as const, label: "CANCELLED" };
  if (status === "EXPIRED") return { tone: "muted" as const, label: "EXPIRED" };
  if (status === "REJECTED" || status === "ACCESS_DENIED") {
    return { tone: "danger" as const, label: "REJECTED – ACCESS NOT AUTHORIZED" };
  }
  if (isInside(status)) return { tone: "ok" as const, label: "CURRENTLY INSIDE" };
  if (status === "COMPLETED" || status === "CHECKED_OUT") {
    return { tone: "muted" as const, label: "CHECKED OUT / COMPLETED" };
  }
  return { tone: "muted" as const, label: status.replaceAll("_", " ") };
}
