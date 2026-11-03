import { addTimeline, writeAudit } from "./audit";
import { startArrangements } from "./arrangements";
import { SALMA_EMAILS, type GuestKind, type TourType } from "./constants";
import { visitTypeFromKind } from "./email-template";
import { isGuestBookableRoom, roomsWithAvailability } from "./graph";
import { fmtDate, fmtTime } from "./format";
import { makeQrToken, nextVisitCode } from "./ids";
import { notify, notifyRoles } from "./notify";
import { canUseRequestDesk } from "./access";
import { canManageIntake, type SessionUser } from "./permissions";
import { bookStaffRoomHold, omitInvitee, parseRoomInvitees, parseStoredInvitees, syncOutlookRoom } from "./room-booking";
import { sendCalendarCancelEmail } from "./mail";
import { prisma } from "./prisma";
import { assertFutureVisit, combineVisitDateTime } from "./visit-schedule";
import { applyTourType, notifyNamed } from "./tours";
import { upsertVisitor } from "./visits";

const HIDDEN_HOST = "olga@neweast.co";

export type StaffVisitorInput = {
  fullName: string;
  mobile: string;
  email: string;
  company: string;
  jobTitle: string;
  nationality: string;
  gatePassRequired?: boolean;
  giftRequired?: boolean;
  giftType?: string;
};

export type StaffRequestInput = {
  visitDate: string;
  arrivalTime: string;
  endTime?: string;
  departmentId: string;
  guestKind: GuestKind;
  visitTitle: string;
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

function visitEnd(visitDate: string, arrival: string, endTime?: string) {
  const start = combineVisitDateTime(visitDate, arrival);
  const end = combineVisitDateTime(visitDate, endTime || "");
  if (!endTime || end <= start) throw new Error("End time must be after the arrival time.");
  return { start, end };
}

function requiredTitle(value: string) {
  const title = value.trim();
  if (!title) throw new Error("Title of visit is required.");
  return title;
}

function personFlags(input: StaffRequestInput) {
  const passAll = input.gatePassRequired && input.visitors.every((visitor) => !visitor.gatePassRequired);
  const giftAll = input.giftRequired && input.visitors.every((visitor) => !visitor.giftRequired);
  return input.visitors.map((visitor) => ({
    ...visitor,
    fullName: visitor.fullName.trim(),
    gatePassRequired: Boolean(visitor.gatePassRequired) || passAll,
    giftRequired: Boolean(visitor.giftRequired) || giftAll,
    giftType: (visitor.giftType || (giftAll ? input.giftType || "" : "")).trim(),
  }));
}

function linkData(
  visitorId: string,
  index: number,
  visitor: ReturnType<typeof personFlags>[number],
  previous?: {
    attachmentsJson: string | null;
    gatePassStatus: string | null;
    gatePassNote: string | null;
    gatePassFile: string | null;
    giftStatus: string | null;
    giftNote: string | null;
  },
) {
  return {
    visitorId,
    isPrimary: index === 0,
    sortOrder: index,
    attachmentsJson: previous?.attachmentsJson || null,
    gatePassRequired: visitor.gatePassRequired,
    gatePassStatus: visitor.gatePassRequired ? previous?.gatePassStatus || "PENDING" : null,
    gatePassNote: visitor.gatePassRequired ? previous?.gatePassNote || null : null,
    gatePassFile: visitor.gatePassRequired ? previous?.gatePassFile || null : null,
    giftRequired: visitor.giftRequired,
    giftType: visitor.giftRequired ? visitor.giftType || null : null,
    giftStatus: visitor.giftRequired ? previous?.giftStatus || "PENDING" : null,
    giftNote: visitor.giftRequired ? previous?.giftNote || null : null,
  };
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
  const visitTitle = requiredTitle(input.visitTitle);
  const purpose = input.purpose.trim();
  if (!input.departmentId) throw new Error("Choose a department.");
  const proposedRoom = optionalRoom(input.meetingRoom);
  if (input.giftRequired && !input.giftType?.trim() && input.visitors.every((visitor) => !visitor.giftType?.trim())) {
    throw new Error("Choose a gift type.");
  }
  assertFutureVisit(input.visitDate, input.arrivalTime);
  const { start, end } = visitEnd(input.visitDate, input.arrivalTime, input.endTime);
  await assertRoomFree(proposedRoom, start, end);

  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw new Error("Choose a department.");
  const flagged = personFlags({ ...input, visitors: visitorsIn });
  const visitors = await Promise.all(
    flagged.map((visitor) =>
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
      visitTitle,
      purpose,
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
      lineManagerId: null,
      source: "STAFF",
      guestKind: input.guestKind,
      meetingRoom: proposedRoom || null,
      driverRequired: input.driverRequired,
      pickupRequired: input.driverRequired,
      giftRequired: flagged.some((visitor) => visitor.giftRequired),
      giftType: flagged.find((visitor) => visitor.giftRequired)?.giftType || null,
      gatePassRequired: flagged.some((visitor) => visitor.gatePassRequired),
      tourType: input.tourType || "NONE",
      colleagueInvitees: JSON.stringify(parseRoomInvitees(input.inviteEmails || [], actor.email)),
      visitors: {
        create: visitors.map((visitor, index) => linkData(visitor.id, index, flagged[index])),
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
    purpose: visitTitle,
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

export async function cancelVisitInvitee(actor: SessionUser, visitId: string, email: string, reason: string) {
  const note = reason.trim();
  if (!note) throw new Error("Write a cancellation reason.");
  const key = email.trim().toLowerCase();
  if (!key.includes("@")) throw new Error("Choose a person to cancel.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!visit) throw new Error("Visit was not found.");
  if (!canEditStaffRequest(actor, visit)) throw new Error("This request can no longer be edited.");
  const person = parseStoredInvitees(visit.colleagueInvitees).find((item) => item.email === key);
  if (!person) throw new Error("That person is not on the invitation.");
  if (visit.calendarInvitedAt) {
    const end =
      visit.expectedDeparture && visit.expectedDeparture > visit.expectedArrival
        ? visit.expectedDeparture
        : new Date(visit.expectedArrival.getTime() + 60 * 60 * 1000);
    const originator = visit.createdBy.name.trim() || "NEWEAST";
    const title = visit.visitTitle.trim();
    await sendCalendarCancelEmail({
      to: person.email,
      name: person.name,
      fromName: originator,
      subject: title ? `${title} - ${originator}` : originator,
      reason: note,
      start: visit.expectedArrival,
      end,
      location: visit.meetingRoom || "Meeting room",
      uid: `${visit.id}@guest.neweast.co`,
    });
  }
  await prisma.visit.update({
    where: { id: visitId },
    data: { colleagueInvitees: JSON.stringify(omitInvitee(visit.colleagueInvitees, key)) },
  });
  if (visit.outlookEventId) {
    const hold = await prisma.roomHold.findFirst({ where: { eventId: visit.outlookEventId, cancelledAt: null } });
    if (hold) {
      await prisma.roomHold.update({
        where: { id: hold.id },
        data: {
          invitees: JSON.stringify(omitInvitee(hold.invitees, key)),
          pinnedAttendees: JSON.stringify(omitInvitee(hold.pinnedAttendees, key)),
        },
      });
    }
  }
  await addTimeline({ visitId, event: "Invitee cancelled", note: `${person.name}: ${note}`, userId: actor.id });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: "Invitee cancelled",
    module: "Staff request",
    newValue: { name: person.name, reason: note },
  });
}

export async function cancelVisitGuest(actor: SessionUser, visitId: string, linkId: string, reason: string) {
  const note = reason.trim();
  if (!note) throw new Error("Write a cancellation reason.");
  if (!linkId) throw new Error("Choose a guest to cancel.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      visitors: { include: { visitor: true }, orderBy: [{ sortOrder: "asc" }, { isPrimary: "desc" }] },
    },
  });
  if (!visit) throw new Error("Visit was not found.");
  if (!canEditStaffRequest(actor, visit)) throw new Error("This request can no longer be edited.");
  if (visit.visitors.length <= 1) throw new Error("A visit needs at least one guest.");
  const link = visit.visitors.find((item) => item.id === linkId);
  if (!link) throw new Error("That guest is not on this visit.");
  const remaining = visit.visitors.filter((item) => item.id !== linkId);
  await prisma.visitVisitor.delete({ where: { id: link.id } });
  for (const [index, item] of remaining.entries()) {
    await prisma.visitVisitor.update({
      where: { id: item.id },
      data: { sortOrder: index, isPrimary: index === 0 },
    });
  }
  await prisma.visit.update({
    where: { id: visitId },
    data: { visitorCount: remaining.length },
  });
  await addTimeline({ visitId, event: "Guest cancelled", note: `${link.visitor.fullName}: ${note}`, userId: actor.id });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: "Guest cancelled",
    module: "Staff request",
    newValue: { name: link.visitor.fullName, reason: note },
  });
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
  const visitTitle = requiredTitle(input.visitTitle);
  const purpose = input.purpose.trim();
  if (!input.departmentId) throw new Error("Choose a department.");
  const proposedRoom = optionalRoom(input.meetingRoom);
  if (input.giftRequired && !input.giftType?.trim() && input.visitors.every((visitor) => !visitor.giftType?.trim())) {
    throw new Error("Choose a gift type.");
  }
  const { start, end } = visitEnd(input.visitDate, input.arrivalTime, input.endTime);
  const sameSlot =
    (current.meetingRoom || "").toLowerCase() === proposedRoom.toLowerCase() &&
    Math.abs(current.expectedArrival.getTime() - start.getTime()) < 60_000;
  if (!sameSlot) {
    assertFutureVisit(input.visitDate, input.arrivalTime);
    await assertRoomFree(proposedRoom, start, end);
  }
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw new Error("Choose a department.");
  const flagged = personFlags({ ...input, visitors: visitorsIn });
  const visitors = await Promise.all(
    flagged.map((visitor) =>
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
  const previous = await prisma.visitVisitor.findMany({ where: { visitId } });
  const previousByVisitor = new Map(previous.map((link) => [link.visitorId, link]));
  await prisma.visitVisitor.deleteMany({ where: { visitId } });
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      type: visitTypeFromKind(input.guestKind),
      status: current.status === "MANAGER_REVIEW" ? "INTAKE" : current.status,
      visitTitle,
      purpose,
      visitDate: new Date(`${input.visitDate}T00:00:00`),
      expectedArrival: start,
      expectedDeparture: end,
      departmentId: department.id,
      visitorCount: visitors.length,
      vip: input.guestKind === "VIP",
      guestKind: input.guestKind,
      meetingRoom: proposedRoom || null,
      driverRequired: input.driverRequired,
      pickupRequired: input.driverRequired,
      giftRequired: flagged.some((visitor) => visitor.giftRequired),
      giftType: flagged.find((visitor) => visitor.giftRequired)?.giftType || null,
      gatePassRequired: flagged.some((visitor) => visitor.gatePassRequired),
      tourType: input.tourType || "NONE",
      colleagueInvitees: JSON.stringify(parseRoomInvitees(input.inviteEmails || [], current.createdById === actor.id ? actor.email : "")),
      visitors: {
        create: visitors.map((visitor, index) => linkData(visitor.id, index, flagged[index], previousByVisitor.get(visitor.id))),
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
      `Title: ${input.purpose}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  await notifyNamed({
    emails: SALMA_EMAILS,
    name: "Salma Moufallah",
    visitId: input.visitId,
    type: "INTAKE_READY",
    title: "New guest visit request",
    message: [
      `${input.requesterName} submitted a guest visit request.`,
      `Guest: ${input.guest}`,
      `Title: ${input.purpose}`,
      input.room ? `Proposed room: ${input.room}` : "",
      input.visitCode,
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
  const visitTitle = requiredTitle(input.visitTitle);
  const purpose = input.purpose.trim();
  if (!input.departmentId) throw new Error("Choose a department.");
  if (!input.roomName.trim()) throw new Error("Choose a room.");
  assertFutureVisit(input.visitDate, input.arrivalTime);
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw new Error("Choose a department.");
  const flagged = personFlags({ ...input, visitors: visitorsIn });
  const visitors = await Promise.all(
    flagged.map((visitor) =>
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
  const { start, end } = visitEnd(input.visitDate, input.arrivalTime, input.endTime);
  const visit = await prisma.visit.create({
    data: {
      visitCode: await nextVisitCode(),
      type: visitTypeFromKind(input.guestKind),
      status: "INTAKE",
      visitTitle,
      purpose,
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
      giftRequired: flagged.some((visitor) => visitor.giftRequired),
      giftType: flagged.find((visitor) => visitor.giftRequired)?.giftType || null,
      gatePassRequired: flagged.some((visitor) => visitor.gatePassRequired),
      tourType: input.tourType || "NONE",
      visitors: {
        create: visitors.map((visitor, index) => linkData(visitor.id, index, flagged[index])),
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
    subject: visitTitle,
    description: purpose,
    inviteEmails: input.inviteEmails,
    purpose,
    visitTitle,
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
