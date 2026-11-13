import { addTimeline, writeAudit } from "./audit";
import { startArrangements } from "./arrangements";
import { SALMA_EMAILS, SAWSAN_EMAILS, type GuestKind, type TourType } from "./constants";
import { visitTypeFromKind } from "./email-template";
import { assertRoomFreeInOutlook, isGuestBookableRoom, placePersonalCalendarMeeting, removePersonalCalendarMeeting } from "./graph";
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
  linkId?: string;
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

export function claimPreviousLink<T extends { id: string; visitorId: string }>(
  previous: T[],
  used: Set<string>,
  linkId: string | undefined,
  visitorId: string,
) {
  const wanted = linkId?.trim();
  const found =
    (wanted ? previous.find((link) => link.id === wanted && !used.has(link.id)) : undefined) ||
    previous.find((link) => link.visitorId === visitorId && !used.has(link.id));
  if (!found) return undefined;
  used.add(found.id);
  return found;
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

const OPEN_VISIT_EXCLUDED = ["CANCELLED", "REJECTED", "DRAFT", "COMPLETED", "CHECKED_OUT", "NO_SHOW", "EXPIRED", "ACCESS_DENIED", "PASSED"];

export async function assertRoomFree(room: string, start: Date, end: Date, self?: { visitId?: string; eventId?: string | null }) {
  if (!room) return;
  if (!isGuestBookableRoom(room)) throw new Error("Choose a ground-floor city room.");
  // Our own records first: intake requests hold a room here before Outlook has any booking for it.
  const sameWindow = await prisma.visit.findMany({
    where: {
      id: self?.visitId ? { not: self.visitId } : undefined,
      status: { notIn: OPEN_VISIT_EXCLUDED },
      expectedArrival: { lt: end, gt: new Date(start.getTime() - 24 * 60 * 60 * 1000) },
      meetingRoom: { not: null },
    },
    select: { visitCode: true, meetingRoom: true, expectedArrival: true, expectedDeparture: true },
  });
  const clash = sameWindow.find((visit) => {
    if ((visit.meetingRoom || "").trim().toLowerCase() !== room.trim().toLowerCase()) return false;
    const otherEnd =
      visit.expectedDeparture && visit.expectedDeparture > visit.expectedArrival
        ? visit.expectedDeparture
        : new Date(visit.expectedArrival.getTime() + 60 * 60 * 1000);
    return otherEnd > start;
  });
  if (clash) {
    throw new Error(`${room} is already taken by ${clash.visitCode} at ${fmtTime(clash.expectedArrival)}. Choose another room or time.`);
  }
  await assertRoomFreeInOutlook(room, start, end, { eventId: self?.eventId });
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
  await notifySawsanArrival({
    visitId: visit.id,
    visitCode: visit.visitCode,
    kind: input.guestKind,
    title: visitTitle,
    when: start,
    guests: visitorsIn.map((visitor) => visitor.fullName),
    requesterName: actor.name,
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
    const subject = title ? `${title} - ${originator}` : originator;
    await sendCalendarCancelEmail({
      to: person.email,
      name: person.name,
      fromName: originator,
      subject,
      reason: note,
      start: visit.expectedArrival,
      end,
      location: visit.meetingRoom || "Meeting room",
      uid: `${visit.id}@guest.neweast.co`,
    });
    await removePersonalCalendarMeeting(person.email, { subject, start: visit.expectedArrival }).catch(() => undefined);
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

function inviteeWasCancelled(notes: { note: string | null }[], person: { email: string; name: string }) {
  const email = person.email.trim().toLowerCase();
  const name = person.name.trim().toLowerCase();
  const local = email.split("@")[0] || "";
  return notes.some((row) => {
    const note = (row.note || "").trim().toLowerCase();
    return note.startsWith(`${name}:`) || Boolean(local && note.startsWith(`${local}:`)) || note.includes(email);
  });
}

async function inviteesPutBack(visitId: string, people: { email: string; name: string }[]) {
  if (!people.length) return [];
  const notes = await prisma.timelineEvent.findMany({
    where: { visitId, event: "Invitee cancelled" },
    select: { note: true },
  });
  return people.filter((person) => inviteeWasCancelled(notes, person));
}

function meetingSubject(title: string, originator: string) {
  const name = originator.trim() || "NEWEAST";
  const label = title.trim();
  return label ? `${label} - ${name}` : name;
}

function dubaiWhen(start: Date, end: Date) {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(start);
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${day}, ${clock.format(start)}–${clock.format(end)}`;
}

async function placeReturnedInvitees(input: {
  visit: { id: string; visitTitle: string; createdBy: { name: string } };
  people: { email: string; name: string }[];
  start: Date;
  end: Date;
  room: string;
}) {
  const subject = meetingSubject(input.visit.visitTitle, input.visit.createdBy.name);
  const placed: string[] = [];
  for (const person of input.people) {
    try {
      await placePersonalCalendarMeeting(person.email, {
        subject,
        description: `${dubaiWhen(input.start, input.end)}\n${input.room}`,
        start: input.start,
        end: input.end,
        location: input.room,
      });
      placed.push(person.email);
    } catch {
      await addTimeline({ visitId: input.visit.id, event: "Calendar place failed", note: person.email });
    }
  }
  if (placed.length) await addTimeline({ visitId: input.visit.id, event: "Calendar placed", note: placed.join(", ") });
  return placed;
}

export async function restorePutBackCalendars(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      createdBy: { select: { name: true } },
      timeline: { orderBy: { createdAt: "asc" }, select: { event: true, note: true, createdAt: true } },
    },
  });
  if (!visit?.calendarInvitedAt || !visit.meetingRoom) return [];
  const people = parseStoredInvitees(visit.colleagueInvitees).filter((person) => {
    const cancelledAt = [...visit.timeline]
      .reverse()
      .find((row) => row.event === "Invitee cancelled" && inviteeWasCancelled([row], person))?.createdAt;
    if (!cancelledAt) return false;
    return !visit.timeline.some(
      (row) =>
        row.createdAt > cancelledAt &&
        /calendar invitation sent/i.test(row.event) &&
        (row.note || "").toLowerCase().includes(person.email),
    );
  });
  const end =
    visit.expectedDeparture && visit.expectedDeparture > visit.expectedArrival
      ? visit.expectedDeparture
      : new Date(visit.expectedArrival.getTime() + 60 * 60 * 1000);
  return placeReturnedInvitees({
    visit,
    people,
    start: visit.expectedArrival,
    end,
    room: visit.meetingRoom,
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
    Math.abs(current.expectedArrival.getTime() - start.getTime()) < 60_000 &&
    Math.abs((current.expectedDeparture?.getTime() ?? 0) - end.getTime()) < 60_000;
  if (!sameSlot) {
    assertFutureVisit(input.visitDate, input.arrivalTime);
    await assertRoomFree(proposedRoom, start, end, { visitId, eventId: current.outlookEventId });
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
  const kept = new Set<string>();
  const nextInvitees = parseRoomInvitees(input.inviteEmails || [], current.createdById === actor.id ? actor.email : "");
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
      colleagueInvitees: JSON.stringify(nextInvitees),
      visitors: {
        create: visitors.map((visitor, index) => {
          const old = claimPreviousLink(previous, kept, flagged[index]?.linkId, visitor.id);
          const row = linkData(visitor.id, index, flagged[index], old);
          return old ? { id: old.id, ...row } : row;
        }),
      },
    },
  });
  await applyTourType(visitId, input.tourType || "NONE");
  if (current.outlookEventId) {
    try {
      await syncOutlookRoom(visitId, proposedRoom);
    } catch (error) {
      // Keep the system and Outlook on the same room and time when Outlook refuses the change.
      await prisma.visit.update({
        where: { id: visitId },
        data: {
          meetingRoom: current.meetingRoom,
          expectedArrival: current.expectedArrival,
          expectedDeparture: current.expectedDeparture,
          visitDate: current.visitDate,
        },
      });
      throw error;
    }
  }
  if (current.calendarInvitedAt && proposedRoom) {
    const previousEmails = new Set(parseStoredInvitees(current.colleagueInvitees).map((person) => person.email));
    const added = nextInvitees.filter((person) => !previousEmails.has(person.email));
    const returned = await inviteesPutBack(visitId, added);
    if (returned.length) await placeReturnedInvitees({ visit: current, people: returned, start, end, room: proposedRoom });
  }
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
  await notifySawsanArrival({
    visitId: visit.id,
    visitCode: visit.visitCode,
    kind: input.guestKind,
    title: visitTitle,
    when: start,
    guests: visitorsIn.map((visitor) => visitor.fullName),
    requesterName: actor.name,
  });
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

const SAWSAN_KINDS = new Set(["GUEST", "VIP", "SUPPLIER"]);

async function notifySawsanArrival(input: {
  visitId: string;
  visitCode: string;
  kind: string;
  title: string;
  when: Date;
  guests: string[];
  requesterName: string;
}) {
  if (!SAWSAN_KINDS.has(input.kind)) return;
  await notifyNamed({
    emails: SAWSAN_EMAILS,
    name: "Sawsan",
    visitId: input.visitId,
    type: "INTAKE_READY",
    title: `${input.visitCode} · ${input.title}`,
    message: [
      `${input.requesterName} submitted a ${input.kind.toLowerCase()} visit.`,
      `Title: ${input.title}`,
      `Date: ${fmtDate(input.when)} ${fmtTime(input.when)}`,
      `Guests: ${input.guests.filter(Boolean).join(", ") || "—"}`,
      `Requester: ${input.requesterName}`,
      input.visitCode,
    ].join("\n"),
  });
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
