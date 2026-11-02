import { addTimeline, writeAudit } from "./audit";
import { startArrangements } from "./arrangements";
import { type GuestKind, type TourType } from "./constants";
import { visitTypeFromKind } from "./email-template";
import { isGuestBookableRoom, roomsWithAvailability } from "./graph";
import { fmtDate, fmtTime } from "./format";
import { makeQrToken, nextVisitCode } from "./ids";
import { notify, notifyRoles } from "./notify";
import { canUseRequestDesk } from "./access";
import { canManageIntake, type SessionUser } from "./permissions";
import { bookStaffRoomHold, parseRoomInvitees, syncOutlookRoom } from "./room-booking";
import { prisma } from "./prisma";
import { assertFutureVisit, combineVisitDateTime } from "./visit-schedule";
import { applyTourType } from "./tours";
import { upsertVisitor } from "./visits";

const HIDDEN_HOST = "olga@neweast.co";

export type StaffVisitorInput = {
  fullName: string;
  mobile: string;
  email: string;
  company: string;
  jobTitle: string;
  nationality: string;
};

export type StaffRequestInput = {
  visitDate: string;
  arrivalTime: string;
  departmentId: string;
  guestKind: GuestKind;
  purpose: string;
  driverRequired: boolean;
  giftRequired: boolean;
  giftType: string | null;
  gatePassRequired: boolean;
  visitors: StaffVisitorInput[];
  tourType?: TourType;
  meetingRoom?: string;
  inviteEmails?: string[];
};

export function isDeskSource(source: string) {
  return source === "EMAIL" || source === "STAFF";
}

function optionalRoom(value?: string | null) {
  const room = (value || "").trim();
  if (!room || /^n\/?a$/i.test(room)) return "";
  return room;
}

async function assertRoomFree(room: string, start: Date, end: Date) {
  if (!room) return;
  if (!isGuestBookableRoom(room)) throw new Error("Choose a ground-floor city room.");
  const availability = await roomsWithAvailability(start, end).catch(() => []);
  const proposed = availability.find((item) => item.name.toLowerCase() === room.toLowerCase());
  if (proposed && !proposed.available) throw new Error("That room is already booked. Choose a free room.");
}

async function lineManagerFor(actor: SessionUser) {
  const me = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { managerName: true, name: true },
  });
  const name = me?.managerName?.trim();
  if (!name || name.toLowerCase() === me?.name.toLowerCase()) return null;
  const people = await prisma.user.findMany({
    where: { isActive: true, NOT: { email: HIDDEN_HOST } },
    select: { id: true, name: true, email: true },
  });
  return people.find((person) => person.name.toLowerCase() === name.toLowerCase()) || null;
}

export async function requesterLineManager(actor: SessionUser) {
  const manager = await lineManagerFor(actor);
  return manager ? { id: manager.id, name: manager.name } : null;
}

export async function createStaffRequest(actor: SessionUser, input: StaffRequestInput) {
  if (!canUseRequestDesk(actor)) {
    throw new Error("This account cannot submit a visit request.");
  }
  if (actor.email.toLowerCase() === HIDDEN_HOST) throw new Error("This account cannot request a visit.");
  const visitorsIn = input.visitors.map((visitor) => ({ ...visitor, fullName: visitor.fullName.trim() })).filter((visitor) => visitor.fullName);
  if (!visitorsIn.length) throw new Error("Add at least one guest.");
  if (visitorsIn.some((visitor) => visitor.email.trim() && !visitor.email.includes("@"))) {
    throw new Error("Guest email is not valid.");
  }
  if (!input.purpose.trim()) throw new Error("Purpose is required.");
  if (!input.departmentId) throw new Error("Choose a department.");
  const proposedRoom = optionalRoom(input.meetingRoom);
  if (input.giftRequired && !input.giftType?.trim()) throw new Error("Choose a gift type.");
  assertFutureVisit(input.visitDate, input.arrivalTime);
  const start = combineVisitDateTime(input.visitDate, input.arrivalTime);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  await assertRoomFree(proposedRoom, start, end);

  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw new Error("Choose a department.");
  const visitors = await Promise.all(
    visitorsIn.map((visitor, index) =>
      upsertVisitor({
        fullName: visitor.fullName,
        mobile: visitor.mobile.replace(/\s+/g, ""),
        email: visitor.email,
        company: visitor.company,
        jobTitle: visitor.jobTitle,
        nationality: visitor.nationality,
        visitorType: input.guestKind,
      }),
    ),
  );

  const visit = await prisma.visit.create({
    data: {
      visitCode: await nextVisitCode(),
      type: visitTypeFromKind(input.guestKind),
      status: "INTAKE",
      purpose: input.purpose.trim(),
      visitDate: new Date(`${input.visitDate}T00:00:00`),
      expectedArrival: combineVisitDateTime(input.visitDate, input.arrivalTime),
      hostId: actor.id,
      departmentId: department.id,
      visitorCount: visitors.length,
      vip: input.guestKind === "VIP",
      accessArea: "General Offices",
      qrToken: makeQrToken(),
      createdById: actor.id,
      lineManagerId: null,
      source: "STAFF",
      guestKind: input.guestKind,
      meetingRoom: proposedRoom || null,
      driverRequired: input.driverRequired,
      pickupRequired: input.driverRequired,
      giftRequired: input.giftRequired,
      giftType: input.giftRequired ? input.giftType?.trim() || null : null,
      gatePassRequired: input.gatePassRequired,
      tourType: input.tourType || "NONE",
      colleagueInvitees: JSON.stringify(parseRoomInvitees(input.inviteEmails || [], actor.email)),
      visitors: {
        create: visitors.map((visitor, index) => ({
          visitorId: visitor.id,
          isPrimary: index === 0,
        })),
      },
    },
  });
  await applyTourType(visit.id, input.tourType || "NONE");

  await addTimeline({
    visitId: visit.id,
    event: "Sent to reception",
    userId: actor.id,
  });
  await writeAudit({
    userId: actor.id,
    visitId: visit.id,
    action: "Staff visit requested",
    module: "Staff request",
    newValue: { visitCode: visit.visitCode },
  });

  const guest = visitorsIn[0]?.fullName || "a guest";
  await startArrangements(visit.id);
  await notifyReceptionIntake({
    visitId: visit.id,
    visitCode: visit.visitCode,
    guest,
    requesterName: actor.name,
    purpose: input.purpose.trim(),
    room: proposedRoom || "N/A",
  });

  return { visit, managerName: null as string | null };
}

const EDITABLE_REQUEST = new Set(["INTAKE", "EXPECTED", "APPROVED", "INVITATION_SENT", "PENDING_APPROVAL", "MANAGER_REVIEW"]);

export function canEditStaffRequest(
  actor: SessionUser,
  visit: { status: string; createdById: string },
) {
  if (!EDITABLE_REQUEST.has(visit.status)) return false;
  return actor.id === visit.createdById || canManageIntake(actor.role);
}

export async function updateStaffRequest(actor: SessionUser, visitId: string, input: StaffRequestInput) {
  const current = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!current || current.source !== "STAFF") throw new Error("Visit request was not found.");
  if (!canEditStaffRequest(actor, current)) throw new Error("This request can no longer be edited.");
  const visitorsIn = input.visitors.map((visitor) => ({ ...visitor, fullName: visitor.fullName.trim() })).filter((visitor) => visitor.fullName);
  if (!visitorsIn.length) throw new Error("Add at least one guest.");
  if (visitorsIn.some((visitor) => visitor.email.trim() && !visitor.email.includes("@"))) {
    throw new Error("Guest email is not valid.");
  }
  if (!input.purpose.trim()) throw new Error("Purpose is required.");
  if (!input.departmentId) throw new Error("Choose a department.");
  const proposedRoom = optionalRoom(input.meetingRoom);
  if (input.giftRequired && !input.giftType?.trim()) throw new Error("Choose a gift type.");
  const start = combineVisitDateTime(input.visitDate, input.arrivalTime);
  const sameSlot =
    (current.meetingRoom || "").toLowerCase() === proposedRoom.toLowerCase() &&
    Math.abs(current.expectedArrival.getTime() - start.getTime()) < 60_000;
  if (!sameSlot) {
    assertFutureVisit(input.visitDate, input.arrivalTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    await assertRoomFree(proposedRoom, start, end);
  }
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw new Error("Choose a department.");
  const visitors = await Promise.all(
    visitorsIn.map((visitor) =>
      upsertVisitor({
        fullName: visitor.fullName,
        mobile: visitor.mobile.replace(/\s+/g, ""),
        email: visitor.email,
        company: visitor.company,
        jobTitle: visitor.jobTitle,
        nationality: visitor.nationality,
        visitorType: input.guestKind,
      }),
    ),
  );
  await prisma.visitVisitor.deleteMany({ where: { visitId } });
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      type: visitTypeFromKind(input.guestKind),
      status: current.status === "MANAGER_REVIEW" ? "INTAKE" : current.status,
      purpose: input.purpose.trim(),
      visitDate: new Date(`${input.visitDate}T00:00:00`),
      expectedArrival: start,
      departmentId: department.id,
      visitorCount: visitors.length,
      vip: input.guestKind === "VIP",
      guestKind: input.guestKind,
      meetingRoom: proposedRoom || null,
      driverRequired: input.driverRequired,
      pickupRequired: input.driverRequired,
      giftRequired: input.giftRequired,
      giftType: input.giftRequired ? input.giftType?.trim() || null : null,
      gatePassRequired: input.gatePassRequired,
      tourType: input.tourType || "NONE",
      colleagueInvitees: JSON.stringify(parseRoomInvitees(input.inviteEmails || [], current.createdById === actor.id ? actor.email : "")),
      visitors: {
        create: visitors.map((visitor, index) => ({ visitorId: visitor.id, isPrimary: index === 0 })),
      },
    },
  });
  await applyTourType(visitId, input.tourType || "NONE");
  if (current.outlookEventId) await syncOutlookRoom(visitId, proposedRoom);
  await startArrangements(visitId);
  await addTimeline({ visitId, event: "Request updated", note: actor.name, userId: actor.id });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: "Staff visit updated",
    module: "Staff request",
    newValue: { visitCode: current.visitCode, room: proposedRoom },
  });
  return current;
}

export async function decideStaffRequest(
  actor: SessionUser,
  visitId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
) {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true }, take: 1 } },
  });
  if (visit.source !== "STAFF" || visit.status !== "MANAGER_REVIEW") {
    throw new Error("This request is not waiting on a line manager.");
  }
  if (visit.lineManagerId !== actor.id && actor.role !== "SYSTEM_ADMIN") {
    throw new Error("Only the line manager can decide this request.");
  }
  const comment = note?.trim() || "";
  if (decision === "REJECTED") {
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: "REJECTED", intakeNotes: comment || visit.intakeNotes },
    });
    await addTimeline({ visitId, event: "Line manager declined", note: comment || undefined, userId: actor.id });
    await notify({
      userId: visit.createdById,
      visitId,
      type: "VISIT_DECLINED",
      title: "Visit request declined",
      message: [`Your visit request ${visit.visitCode} was declined by your line manager.`, comment].filter(Boolean).join("\n"),
      onBehalfOf: visit.createdBy.name,
    });
    return;
  }
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: "INTAKE", intakeNotes: comment || visit.intakeNotes },
    });
  await addTimeline({ visitId, event: "Line manager approved", note: comment || "Sent to Administration", userId: actor.id });
  await notify({
    userId: visit.createdById,
    visitId,
    type: "VISIT_UPDATE",
    title: "Visit request with Administration",
    message: [
      `${visit.visitCode} was approved by your line manager and is now with Administration.`,
      comment ? `Comment: ${comment}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    onBehalfOf: visit.createdBy.name,
  });
  const guest = visit.visitors[0]?.visitor.fullName || "a guest";
  await notifyReceptionIntake({
    visitId,
    visitCode: visit.visitCode,
    guest,
    requesterName: visit.createdBy.name,
    purpose: visit.purpose,
    approvedBy: actor.name,
    room: visit.meetingRoom || "",
  });
  await startArrangements(visitId);
}

async function notifyReceptionIntake(input: {
  visitId: string;
  visitCode: string;
  guest: string;
  requesterName: string;
  purpose: string;
  approvedBy?: string;
  room?: string;
}) {
  await notifyRoles(["HR_ADMIN"], {
    visitId: input.visitId,
    type: "INTAKE_READY",
    title: "Visit ready for reception",
    message: [
      `${input.visitCode} needs a meeting room and intake.`,
      input.approvedBy ? `Approved by ${input.approvedBy}.` : "Sent straight to reception.",
      `Requester: ${input.requesterName}`,
      `Guest: ${input.guest}`,
      input.room ? `Proposed room: ${input.room}` : "",
      `Purpose: ${input.purpose}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function createReceptionDeskVisit(
  actor: SessionUser,
  input: StaffRequestInput & { roomName: string; endTime: string; inviteEmails?: string[] },
) {
  if (!canManageIntake(actor.role)) throw new Error("Only reception can book a visitor immediately.");
  const visitorsIn = input.visitors.map((visitor) => ({ ...visitor, fullName: visitor.fullName.trim() })).filter((visitor) => visitor.fullName);
  if (!visitorsIn.length) throw new Error("Add at least one guest.");
  if (visitorsIn.some((visitor) => visitor.email.trim() && !visitor.email.includes("@"))) {
    throw new Error("Guest email is not valid.");
  }
  if (!input.purpose.trim()) throw new Error("Purpose is required.");
  if (!input.departmentId) throw new Error("Choose a department.");
  if (!input.roomName.trim()) throw new Error("Choose a room.");
  assertFutureVisit(input.visitDate, input.arrivalTime);
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw new Error("Choose a department.");
  const visitors = await Promise.all(
    visitorsIn.map((visitor) =>
      upsertVisitor({
        fullName: visitor.fullName,
        mobile: visitor.mobile.replace(/\s+/g, ""),
        email: visitor.email,
        company: visitor.company,
        jobTitle: visitor.jobTitle,
        nationality: visitor.nationality,
        visitorType: input.guestKind,
      }),
    ),
  );
  const start = combineVisitDateTime(input.visitDate, input.arrivalTime);
  const end = combineVisitDateTime(input.visitDate, input.endTime || "");
  if (!input.endTime || end <= start) throw new Error("End time must be after the start time.");
  const visit = await prisma.visit.create({
    data: {
      visitCode: await nextVisitCode(),
      type: visitTypeFromKind(input.guestKind),
      status: "INTAKE",
      purpose: input.purpose.trim(),
      visitDate: new Date(`${input.visitDate}T00:00:00`),
      expectedArrival: start,
      expectedDeparture: end,
      hostId: actor.id,
      departmentId: department.id,
      visitorCount: visitors.length,
      vip: input.guestKind === "VIP",
      accessArea: "General Offices",
      qrToken: makeQrToken(),
      createdById: actor.id,
      source: "ADMIN",
      guestKind: input.guestKind,
      meetingRoom: input.roomName.trim(),
      driverRequired: input.driverRequired,
      pickupRequired: input.driverRequired,
      giftRequired: input.giftRequired,
      giftType: input.giftRequired ? input.giftType?.trim() || null : null,
      gatePassRequired: input.gatePassRequired,
      tourType: input.tourType || "NONE",
      visitors: {
        create: visitors.map((visitor, index) => ({
          visitorId: visitor.id,
          isPrimary: index === 0,
        })),
      },
    },
  });
  await applyTourType(visit.id, input.tourType || "NONE");
  await addTimeline({ visitId: visit.id, event: "Reception visitor booked", note: "No approval — booked at the desk", userId: actor.id });
  await writeAudit({
    userId: actor.id,
    visitId: visit.id,
    action: "Reception visitor booked",
    module: "Rooms",
    newValue: { visitCode: visit.visitCode, room: input.roomName },
  });
  await startArrangements(visit.id);
  await bookStaffRoomHold(actor, {
    visitId: visit.id,
    roomName: input.roomName.trim(),
    start,
    end,
    subject: `${visit.visitCode} · Guest visit · ${input.roomName.trim()}`,
    description: input.purpose.trim(),
    inviteEmails: input.inviteEmails,
    purpose: input.purpose.trim(),
    guestMobile: visitorsIn[0].mobile,
    guestEmail: visitorsIn[0].email,
  });
  return visit;
}

export async function notifyStaffVisitConfirmed(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit || visit.source !== "STAFF") return;
  const end =
    visit.expectedDeparture && visit.expectedDeparture > visit.expectedArrival
      ? visit.expectedDeparture
      : new Date(visit.expectedArrival.getTime() + 60 * 60 * 1000);
  const names = visit.visitors.map((link) => link.visitor.fullName).filter(Boolean);
  await notify({
    userId: visit.createdById,
    visitId,
    type: "VISIT_CONFIRMED",
    title: "Your visit is confirmed",
    message: [
      `${visit.visitCode} is confirmed.`,
      `When: ${fmtDate(visit.expectedArrival)} · ${fmtTime(visit.expectedArrival)}–${fmtTime(end)}`,
      `Room: ${visit.meetingRoom || "Meeting room"}`,
      `Guests: ${names.join(", ") || visit.visitorCount}`,
    ].join("\n"),
    onBehalfOf: visit.createdBy.name,
  });
}
