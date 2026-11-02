import { addTimeline, writeAudit } from "./audit";
import { fmtDate, fmtTime } from "./format";
import { notify } from "./notify";

function isPendingContact(value?: string | null) {
  const text = (value || "").trim();
  return !text || /^(pending:|inbox:)/i.test(text);
}
import {
  acceptBookerMeeting,
  bookGuestRoom,
  cancelGuestRoom,
  createBookerCalendarEvent,
  deleteUserCalendarEvent,
  guestEventRoomReply,
  graphConfigured,
  guestMailbox,
  listGuestDayEvents,
  inviteBookerToGuestEvent,
  readEventICalUId,
  roomMailStatus,
  visitCodeFromSubject,
  type GuestDayEvent,
  type InboxHead,
} from "./graph";
import { sendBookingChangeEmail, sendRoomConfirmEmail, sendStaffRoomHoldEmail } from "./mail";
import type { SessionUser } from "./permissions";
import { prisma } from "./prisma";
import { guestDocHref, parseGuestDocs } from "./guest-doc-types";
import { HANNA_EMAILS, JESMAN_EMAILS, SALMA_EMAILS, SAMIR_EMAILS } from "./constants";
import { briefVisitStakeholders, visitBlocksConfirm } from "./tours";

function bookingError(error: unknown) {
  const message = error instanceof Error ? error.message : "Outlook could not book the room.";
  if (/access is denied|accessdenied|403/i.test(message)) {
    return "Outlook room booking needs Calendars.ReadWrite on the Graph app (admin consent). Until that is granted, the room mailbox cannot send the confirmation to guest@neweast.co.";
  }
  return message;
}

export async function syncOutlookRoom(visitId: string, roomName?: string | null) {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: {
      department: true,
      visitors: { include: { visitor: true }, take: 1 },
    },
  });
  const name = (roomName ?? visit.meetingRoom ?? "").trim();
  const empty = !name || name === "Yes";

  if (empty) {
    await releaseOutlookRoom(visitId, { reason: "The meeting room was removed." });
    return { booked: false };
  }

  if (!graphConfigured()) {
    throw new Error("Outlook is not configured, so the room cannot be booked.");
  }

  const start = visit.expectedArrival;
  const end =
    visit.expectedDeparture && visit.expectedDeparture > start
      ? visit.expectedDeparture
      : new Date(start.getTime() + 60 * 60 * 1000);
  const guest = visit.visitors[0]?.visitor;
  const previous = visit.outlookEventId
    ? await prisma.roomHold.findFirst({ where: { eventId: visit.outlookEventId, cancelledAt: null } })
    : null;
  try {
    const booked = await bookGuestRoom({
      eventId: visit.outlookEventId,
      roomName: name,
      start,
      end,
      subject: `${visit.visitCode} · ${guest?.fullName || "Guest visit"}`,
      body: [
        visit.purpose,
        `Department: ${visit.department.name}`,
        `People: ${visit.visitorCount}`,
        "Organizer: guest@neweast.co",
      ].join("\n"),
    });
    await prisma.visit.update({
      where: { id: visitId },
      data: {
        meetingRoom: booked.roomName,
        outlookEventId: booked.eventId,
        outlookRoomEmail: booked.roomEmail,
      },
    });
    const changed = Boolean(
      previous &&
        (previous.roomName.toLowerCase() !== booked.roomName.toLowerCase() ||
          Math.abs(previous.startAt.getTime() - start.getTime()) >= 60_000 ||
          Math.abs(previous.endAt.getTime() - end.getTime()) >= 60_000),
    );
    if (changed && previous) {
      await notifyBookingChange({
        visitId,
        eventId: booked.eventId,
        kind: "updated",
        room: booked.roomName,
        start,
        end,
        subject: `${visit.visitCode} · ${guest?.fullName || "Guest visit"}`,
        reason: visit.purpose,
      });
      await prisma.roomHold.update({
        where: { id: previous.id },
        data: {
          roomName: booked.roomName,
          roomEmail: booked.roomEmail,
          startAt: start,
          endAt: end,
          description: visit.purpose,
          subject: `${visit.visitCode} · ${guest?.fullName || "Guest visit"}`,
        },
      });
    }
    return { booked: true, roomName: booked.roomName };
  } catch (error) {
    throw new Error(bookingError(error));
  }
}

export async function emailVisitCancelled(visitId: string, reason: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      outlookEventId: true,
      meetingRoom: true,
      expectedArrival: true,
      expectedDeparture: true,
      purpose: true,
      visitCode: true,
    },
  });
  if (!visit) return;
  const hold = visit.outlookEventId
    ? await prisma.roomHold.findFirst({ where: { eventId: visit.outlookEventId, cancelledAt: null } })
    : null;
  const start = hold?.startAt || visit.expectedArrival;
  await notifyBookingChange({
    visitId,
    eventId: visit.outlookEventId,
    kind: "cancelled",
    reason,
    room: hold?.roomName || visit.meetingRoom || "Meeting room",
    start,
    end: hold?.endAt || visit.expectedDeparture || new Date(start.getTime() + 60 * 60 * 1000),
    subject: hold?.subject || `${visit.visitCode} · ${visit.purpose}`,
  });
}

export async function releaseOutlookRoom(visitId: string, options?: { notify?: boolean; reason?: string }) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      outlookEventId: true,
      outlookRoomEmail: true,
      meetingRoom: true,
      expectedArrival: true,
      expectedDeparture: true,
      purpose: true,
      visitCode: true,
    },
  });
  if (!visit?.outlookEventId) {
    if (visit?.outlookRoomEmail) {
      await prisma.visit.update({ where: { id: visitId }, data: { outlookRoomEmail: null } });
    }
    return;
  }
  if (!graphConfigured()) {
    await prisma.visit.update({
      where: { id: visitId },
      data: { outlookEventId: null, outlookRoomEmail: null },
    });
    return;
  }
  const hold = await prisma.roomHold.findFirst({ where: { eventId: visit.outlookEventId, cancelledAt: null } });
  const start = hold?.startAt || visit.expectedArrival;
  if (options?.notify !== false) {
    await notifyBookingChange({
      visitId,
      eventId: visit.outlookEventId,
      kind: "cancelled",
      reason: options?.reason,
      room: hold?.roomName || visit.meetingRoom || "Meeting room",
      start,
      end: hold?.endAt || visit.expectedDeparture || new Date(start.getTime() + 60 * 60 * 1000),
      subject: hold?.subject || `${visit.visitCode} · ${visit.purpose}`,
    });
  }
  await cancelGuestRoom(visit.outlookEventId, hold ? holdOrganizer(hold) : undefined);
  if (hold?.bookerEventId && hold.bookerEventId !== visit.outlookEventId) {
    await deleteUserCalendarEvent(hold.bookedByEmail, hold.bookerEventId).catch(() => undefined);
  }
  if (hold) {
    await prisma.roomHold.update({
      where: { id: hold.id },
      data: { cancelledAt: new Date(), cancelReason: options?.reason || "Cancelled" },
    });
  }
  await prisma.visit.update({
    where: { id: visitId },
    data: { outlookEventId: null, outlookRoomEmail: null },
  });
}

function markReplyDone(notes: string | null) {
  if (notes?.includes("Reply done")) return notes;
  return notes ? `${notes}\n\nReply done` : "Reply done";
}

export function staffRoomEventBody(input: { name: string; email: string; description?: string }) {
  const description = input.description?.trim() || "";
  return [
    `Booked from Guest Management by ${input.name} <${input.email}>.`,
    description ? `Description\n${description}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type RoomInvitee = { email: string; name: string };

export function parseRoomInvitees(values: string[], bookerEmail = "") {
  const seen = new Set([bookerEmail.trim().toLowerCase()].filter(Boolean));
  const items: RoomInvitee[] = [];
  for (const raw of values) {
    for (const part of raw.split(/[\s,;]+/)) {
      const email = part.replace(/[<>]/g, "").trim().toLowerCase();
      if (!email.includes("@") || seen.has(email)) continue;
      seen.add(email);
      items.push({ email, name: email.split("@")[0] || email });
      if (items.length >= 20) return items;
    }
  }
  return items;
}

export function parseStoredInvitees(raw?: string | null): RoomInvitee[] {
  if (!raw?.trim()) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return parseRoomInvitees(
      data.map((item) => (item && typeof item === "object" && "email" in item ? String((item as RoomInvitee).email || "") : String(item || ""))),
    ).map((item) => {
      const row = Array.isArray(data)
        ? data.find((entry) => entry && typeof entry === "object" && String((entry as RoomInvitee).email || "").toLowerCase() === item.email)
        : null;
      const name = row && typeof row === "object" && "name" in row ? String((row as RoomInvitee).name || "").trim() : "";
      return { ...item, name: name || item.name };
    });
  } catch {
    return parseRoomInvitees([raw]);
  }
}

function dubaiClock(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

function holdOrganizer(hold: { organizerEmail?: string | null; bookedByEmail: string }) {
  return (hold.organizerEmail || "").trim() || guestMailbox();
}

export function holdAsDayEvent(hold: {
  eventId: string;
  subject: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  roomName: string;
  roomEmail?: string | null;
  roomReply?: string | null;
  cancelledAt?: Date | null;
}): GuestDayEvent {
  const reply = hold.roomReply === "accepted" || hold.roomReply === "declined" ? hold.roomReply : "pending";
  return {
    id: hold.eventId,
    subject: hold.subject,
    start: dubaiClock(hold.startAt),
    end: dubaiClock(hold.endAt),
    room: hold.roomName,
    roomEmail: hold.roomEmail || undefined,
    roomReply: reply,
    cancelled: Boolean(hold.cancelledAt) || reply === "declined",
    description: hold.description || "",
  };
}

export function mergeRoomDayEvents(outlook: GuestDayEvent[], holds: GuestDayEvent[]) {
  const byId = new Map(outlook.map((event) => [event.id, event]));
  for (const hold of holds) {
    const current = byId.get(hold.id);
    if (!current) {
      byId.set(hold.id, hold);
      continue;
    }
    byId.set(hold.id, { ...current, description: hold.description || current.description });
  }
  return [...byId.values()];
}

export async function listHoldEventsForDay(date: string) {
  const start = new Date(`${date}T00:00:00+04:00`);
  const end = new Date(`${date}T23:59:59+04:00`);
  const rows = await prisma.roomHold.findMany({
    where: { cancelledAt: null, startAt: { gte: start, lte: end } },
  });
  return rows.map(holdAsDayEvent);
}

export async function listRoomInvitePeople() {
  const rows = await prisma.user.findMany({
    where: { isActive: true, email: { not: "" } },
    orderBy: { name: "asc" },
    select: { email: true, name: true, jobTitle: true, department: { select: { name: true } } },
  });
  return rows.map((row) => ({
    value: row.email,
    label: row.name,
    hint: [row.email, row.jobTitle, row.department?.name].filter(Boolean).join(" · "),
  }));
}

export function attachRoomHoldNotes(events: GuestDayEvent[], holds: { eventId: string; description: string }[]) {
  if (!holds.length) return events;
  const notes = new Map(holds.map((row) => [row.eventId, row.description]));
  return events.map((event) => ({ ...event, description: notes.get(event.id) || event.description || "" }));
}

export async function roomHoldNotes(eventIds: string[]) {
  if (!eventIds.length) return [];
  return prisma.roomHold.findMany({
    where: { eventId: { in: eventIds } },
    select: { eventId: true, description: true },
  });
}

export async function flushHoldsFromEvents(events: GuestDayEvent[]) {
  for (const event of events) {
    if (event.roomReply === "pending") continue;
    const hold = await prisma.roomHold.findUnique({
      where: { eventId: event.id },
      select: { id: true, repliedAt: true, cancelledAt: true, bookerEventId: true, roomReply: true },
    });
    if (!hold || hold.cancelledAt) continue;
    const accepted = event.roomReply === "accepted" && !event.cancelled;
    if (!hold.repliedAt) {
      await sendHoldReply(hold.id, accepted).catch(() => undefined);
      continue;
    }
    if (accepted && !hold.bookerEventId) {
      await prisma.roomHold.update({
        where: { id: hold.id },
        data: { roomReply: hold.roomReply || "accepted" },
      });
      await confirmHoldCalendars(hold.id).catch(() => undefined);
    }
  }
}

export async function roomBoardEvents(date: string) {
  const [listed, holds] = await Promise.all([listGuestDayEvents(date), listHoldEventsForDay(date)]);
  const merged = mergeRoomDayEvents(listed, holds);
  await flushHoldsFromEvents(merged).catch(() => undefined);
  return attachRoomHoldNotes(merged, await roomHoldNotes(merged.map((event) => event.id)));
}

export type RoomDeskVisit = {
  id: string;
  visitCode: string;
  purpose: string;
  visitDate: string;
  arrival: string;
  source: string;
  requester: string;
  department: string;
  guestKind: string;
  tourType: string;
  proposedRoom: string;
  invitees: { email: string; name: string }[];
  guests: { id: string; fullName: string; mobile: string; email: string; company: string; jobTitle: string }[];
  docs: { type: "ID" | "PASSPORT" | "VISA"; name: string; href: string }[];
};

function clockOf(date: Date) {
  return fmtTime(date);
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function listRoomDeskVisits(): Promise<RoomDeskVisit[]> {
  const rows = await prisma.visit.findMany({
    where: {
      source: { in: ["STAFF", "EMAIL"] },
      outlookEventId: null,
      status: { in: ["INTAKE", "APPROVED", "EXPECTED", "INVITATION_SENT", "PENDING_APPROVAL"] },
    },
    include: {
      createdBy: { select: { name: true } },
      department: { select: { name: true } },
      visitors: { include: { visitor: true }, orderBy: { isPrimary: "desc" } },
    },
    orderBy: [{ visitDate: "asc" }, { expectedArrival: "asc" }],
    take: 80,
  });
  return rows.map((row) => ({
    id: row.id,
    visitCode: row.visitCode,
    purpose: row.purpose,
    visitDate: dayKey(row.visitDate),
    arrival: clockOf(row.expectedArrival),
    source: row.source,
    requester: row.createdBy.name,
    department: row.department.name,
    guestKind: row.guestKind || row.type,
    tourType: row.tourType || "NONE",
    proposedRoom: row.meetingRoom || "",
    invitees: parseStoredInvitees(row.colleagueInvitees),
    guests: row.visitors.map((link) => ({
      id: link.visitor.id,
      fullName: link.visitor.fullName,
      mobile: isPendingContact(link.visitor.mobile) ? "" : link.visitor.mobile,
      email: link.visitor.email || "",
      company: link.visitor.company || "",
      jobTitle: link.visitor.jobTitle || "",
    })),
    docs: parseGuestDocs(row.attachmentsJson).map((doc) => ({
      type: doc.type,
      name: doc.name,
      href: guestDocHref(row.id, doc.type),
    })),
  }));
}

export async function bookStaffRoomHold(
  actor: SessionUser,
  input: {
    roomName: string;
    start: Date;
    end: Date;
    subject: string;
    description?: string;
    inviteEmails?: string[];
    visitId?: string;
    purpose?: string;
    guestMobile?: string;
    guestEmail?: string;
  },
) {
  let visit:
    | {
        id: string;
        visitCode: string;
        purpose: string;
        visitors: { visitorId: string; visitor: { id: string; mobile: string; email: string | null; fullName: string } }[];
      }
    | null = null;
  if (input.visitId) {
    visit = await prisma.visit.findUnique({
      where: { id: input.visitId },
      include: { visitors: { include: { visitor: true }, orderBy: { isPrimary: "desc" } } },
    });
    if (!visit) throw new Error("Visit request was not found.");
    const purpose = (input.purpose || visit.purpose || "").trim();
    if (!purpose) throw new Error("Add the purpose of the visit.");
    const mobile = (input.guestMobile || "").trim();
    const email = (input.guestEmail || "").trim();
    if (email && !email.includes("@")) throw new Error("Guest email is not valid.");
    const guest = visit.visitors[0]?.visitor;
    if (guest && (mobile || email)) {
      await prisma.visitor.update({
        where: { id: guest.id },
        data: {
          ...(mobile ? { mobile } : {}),
          ...(email ? { email } : {}),
        },
      });
      if (email) guest.email = email;
      if (mobile) guest.mobile = mobile;
    }
    await prisma.visit.update({
      where: { id: visit.id },
      data: {
        purpose,
        expectedArrival: input.start,
        expectedDeparture: input.end,
        visitDate: new Date(`${dayKey(input.start)}T00:00:00`),
        meetingRoom: input.roomName,
      },
    });
    visit = { ...visit, purpose, visitCode: visit.visitCode };
  }
  const subject =
    input.subject.trim() ||
    (visit ? `${visit.visitCode} · Guest visit · ${input.roomName}` : "Guest visit room hold");
  const description = (input.description || "").trim().slice(0, 2000);
  const invitees = parseRoomInvitees(input.inviteEmails || [], actor.email);
  const named = await prisma.user.findMany({
    where: { email: { in: invitees.map((item) => item.email) } },
    select: { email: true, name: true },
  });
  const byEmail = new Map(named.map((row) => [row.email.toLowerCase(), row.name]));
  const guests = invitees.map((item) => ({ ...item, name: byEmail.get(item.email) || item.name }));
  const organizerEmail = actor.email;
  const booked = await bookGuestRoom({
    organizerEmail,
    roomName: input.roomName,
    start: input.start,
    end: input.end,
    subject,
    body: staffRoomEventBody({ name: actor.name, email: actor.email, description }),
    attendees: [],
  });
  await prisma.roomHold.create({
    data: {
      eventId: booked.eventId,
      roomName: booked.roomName,
      roomEmail: booked.roomEmail,
      subject,
      description,
      startAt: input.start,
      endAt: input.end,
      bookedById: actor.id,
      bookedByEmail: actor.email,
      bookedByName: actor.name,
      organizerEmail,
      invitees: JSON.stringify(guests),
      bookerEventId: booked.eventId,
      bookerInvitedAt: new Date(),
    },
  });
  await writeAudit({
    userId: actor.id,
    action: "Room booked",
    module: "Rooms",
    visitId: visit?.id,
    newValue: { eventId: booked.eventId, room: booked.roomName, subject, description, invitees: guests, visitCode: visit?.visitCode },
  });
  if (visit) {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { outlookEventId: booked.eventId, outlookRoomEmail: booked.roomEmail, meetingRoom: booked.roomName },
    });
    await addTimeline({
      visitId: visit.id,
      event: "Meeting room requested",
      note: booked.roomName,
      userId: actor.id,
    });
  }
  return booked;
}

const noticeVisit = {
  createdBy: { select: { email: true, name: true } },
  host: { select: { email: true, name: true } },
  visitors: { include: { visitor: { select: { email: true, fullName: true } } } },
} as const;

async function bookingPeople(eventId?: string | null, visitId?: string | null) {
  const people = new Map<string, string>();
  const add = (email?: string | null, name?: string | null) => {
    const key = (email || "").trim().toLowerCase();
    if (!/@(neweast\.com|neweast\.co)$/i.test(key)) return;
    if (!people.has(key)) people.set(key, (name || "").trim() || key.split("@")[0] || key);
  };
  if (eventId) {
    const hold = await prisma.roomHold.findFirst({ where: { eventId } });
    if (hold) {
      add(hold.bookedByEmail, hold.bookedByName);
      for (const person of [...parseStoredInvitees(hold.invitees), ...parseStoredInvitees(hold.pinnedAttendees)]) {
        add(person.email, person.name);
      }
    }
  }
  const visit = visitId
    ? await prisma.visit.findUnique({ where: { id: visitId }, include: noticeVisit })
    : eventId
      ? await prisma.visit.findFirst({ where: { outlookEventId: eventId }, include: noticeVisit })
      : null;
  if (visit) {
    const guests = new Set(
      visit.visitors.map((link) => (link.visitor.email || "").trim().toLowerCase()).filter((email) => email.includes("@")),
    );
    const keep = (email?: string | null) => {
      const key = (email || "").trim().toLowerCase();
      return key.includes("@") && !guests.has(key);
    };
    if (keep(visit.createdBy.email)) add(visit.createdBy.email, visit.createdBy.name);
    if (keep(visit.host.email)) add(visit.host.email, visit.host.name);
    for (const person of parseStoredInvitees(visit.colleagueInvitees)) {
      if (keep(person.email)) add(person.email, person.name);
    }
    for (const [email, name] of [...people]) {
      if (guests.has(email)) people.delete(email);
    }
  }
  return [...people].map(([email, name]) => ({ email, name }));
}

async function notifyBookingChange(input: {
  visitId?: string | null;
  eventId?: string | null;
  kind: "cancelled" | "updated";
  room: string;
  start: Date;
  end: Date;
  subject: string;
  reason?: string;
}) {
  const people = await bookingPeople(input.eventId, input.visitId);
  for (const person of people) {
    await sendBookingChangeEmail({
      to: person.email,
      name: person.name,
      kind: input.kind,
      room: input.room,
      date: fmtDate(input.start),
      start: fmtTime(input.start),
      end: fmtTime(input.end),
      subject: input.subject,
      reason: input.reason,
    });
  }
}

export async function cancelStaffRoomHold(actor: SessionUser, eventId: string, reason?: string) {
  const note = (reason || "").trim();
  if (!note) throw new Error("Write a cancellation reason.");
  const hold = await prisma.roomHold.findFirst({
    where: { eventId, cancelledAt: null },
  });
  const organizer = hold ? holdOrganizer(hold) : guestMailbox();
  if (hold) {
    await notifyBookingChange({
      eventId,
      kind: "cancelled",
      room: hold.roomName,
      start: hold.startAt,
      end: hold.endAt,
      subject: hold.subject,
      reason: note,
    });
  }
  await cancelGuestRoom(eventId, organizer);
  if (hold?.bookerEventId && hold.bookerEventId !== eventId) {
    await deleteUserCalendarEvent(hold.bookedByEmail, hold.bookerEventId).catch(() => undefined);
  }
  await prisma.roomHold.updateMany({
    where: { eventId, cancelledAt: null },
    data: { cancelledAt: new Date(), cancelReason: note },
  });
  await writeAudit({
    userId: actor.id,
    action: "Room booking cancelled",
    module: "Rooms",
    previousValue: { eventId },
    newValue: { reason: note },
  });
}

async function namedAdmin(emails: readonly string[], name: string) {
  const wanted = new Set(emails.map((email) => email.toLowerCase()));
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { email: true, name: true },
  });
  const user = users.find((item) => wanted.has(item.email.toLowerCase()));
  return { email: (user?.email || emails[0] || "").toLowerCase(), name: user?.name || name };
}

async function loadConfirmPeople(hold: { eventId: string; invitees: string }) {
  const visit = await prisma.visit.findFirst({
    where: { outlookEventId: hold.eventId },
    include: {
      createdBy: { select: { email: true, name: true } },
      visitors: { include: { visitor: { select: { email: true, fullName: true } } } },
    },
  });
  const people = new Map<string, string>();
  const add = (email?: string | null, name?: string | null) => {
    const key = (email || "").trim().toLowerCase();
    if (!/@(neweast\.com|neweast\.co)$/i.test(key)) return;
    if (!people.has(key)) people.set(key, (name || "").trim() || key.split("@")[0] || key);
  };
  const guestEmails = new Set(
    (visit?.visitors || []).map((link) => (link.visitor.email || "").trim().toLowerCase()).filter((email) => email.includes("@")),
  );
  for (const person of parseStoredInvitees(hold.invitees)) {
    if (!guestEmails.has(person.email)) add(person.email, person.name);
  }
  if (visit) {
    add(visit.createdBy.email, visit.createdBy.name);
    for (const person of parseStoredInvitees(visit.colleagueInvitees)) {
      if (!guestEmails.has(person.email)) add(person.email, person.name);
    }
    const kind = (visit.guestKind || visit.type || "").toUpperCase();
    const tour = (visit.tourType || "").toUpperCase();
    if (kind === "CUSTOMER") {
      const admin = await namedAdmin(SAMIR_EMAILS, "Samir Ibrahim");
      add(admin.email, admin.name);
    }
    if (kind === "SUPPLIER") {
      const hanna = await namedAdmin(HANNA_EMAILS, "Hannah Talastas");
      const salma = await namedAdmin(SALMA_EMAILS, "Salma Moufallah");
      add(hanna.email, hanna.name);
      add(salma.email, salma.name);
    }
    if (tour === "GF" || tour === "BUILDING") {
      const hanna = await namedAdmin(HANNA_EMAILS, "Hannah Talastas");
      const salma = await namedAdmin(SALMA_EMAILS, "Salma Moufallah");
      const jesman = await namedAdmin(JESMAN_EMAILS, "Jesman Muruganantham");
      add(hanna.email, hanna.name);
      add(salma.email, salma.name);
      add(jesman.email, jesman.name);
    }
  }
  return [...people].map(([email, name]) => ({ email, name }));
}

async function confirmHoldCalendars(holdId: string) {
  const hold = await prisma.roomHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.cancelledAt || hold.roomReply !== "accepted") return;
  const organizer = holdOrganizer(hold).toLowerCase();
  const people = await loadConfirmPeople(hold);
  const known = new Set(parseStoredInvitees(hold.invitees).map((item) => item.email));
  if (people.some((person) => !known.has(person.email))) {
    await prisma.roomHold.update({ where: { id: hold.id }, data: { invitees: JSON.stringify(people) } });
  }
  const booker = hold.bookedByEmail.trim().toLowerCase();
  if (organizer === booker) {
    await prisma.roomHold.update({
      where: { id: hold.id },
      data: { bookerEventId: hold.bookerEventId || hold.eventId, bookerInvitedAt: hold.bookerInvitedAt || new Date() },
    });
  } else if (!hold.bookerEventId) {
    try {
      const invited = await inviteBookerToGuestEvent(hold.eventId, hold.bookedByEmail, hold.bookedByName, organizer);
      await prisma.roomHold.update({ where: { id: hold.id }, data: { bookerInvitedAt: new Date() } });
      const acceptedId = invited.iCalUId ? await acceptBookerMeeting(hold.bookedByEmail, invited.iCalUId) : null;
      if (acceptedId) {
        await prisma.roomHold.update({ where: { id: hold.id }, data: { bookerEventId: acceptedId } });
      }
    } catch {
      const bookerEventId = await createBookerCalendarEvent(hold.bookedByEmail, {
        subject: hold.subject,
        description: hold.description,
        start: hold.startAt,
        end: hold.endAt,
        roomName: hold.roomName,
        roomEmail: hold.roomEmail,
      });
      await prisma.roomHold.update({
        where: { id: hold.id },
        data: { bookerEventId, bookerInvitedAt: new Date() },
      });
    }
  }
  const pinned = new Set(parseStoredInvitees(hold.pinnedAttendees).map((item) => item.email));
  const pending = people.filter((guest) => !pinned.has(guest.email) && guest.email !== organizer);
  if (!pending.length) return;
  const iCalUId = await readEventICalUId(hold.eventId, organizer).catch(() => "");
  const delivered = [...parseStoredInvitees(hold.pinnedAttendees)];
  for (const guest of pending) {
    await inviteBookerToGuestEvent(hold.eventId, guest.email, guest.name, organizer);
    const acceptedId = iCalUId ? await acceptBookerMeeting(guest.email, iCalUId).catch(() => null) : null;
    if (!acceptedId && /@(neweast\.com|neweast\.co)$/i.test(guest.email)) {
      await createBookerCalendarEvent(guest.email, {
        subject: hold.subject,
        description: hold.description,
        start: hold.startAt,
        end: hold.endAt,
        roomName: hold.roomName,
        roomEmail: hold.roomEmail,
      }).catch(() => undefined);
    }
    delivered.push(guest);
    await prisma.roomHold.update({
      where: { id: hold.id },
      data: { pinnedAttendees: JSON.stringify(delivered) },
    });
  }
}

async function sendHoldReply(holdId: string, accepted: boolean) {
  const hold = await prisma.roomHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.cancelledAt) return { sent: false as const };
  const linked = await prisma.visit.findFirst({
    where: { outlookEventId: hold.eventId },
    select: { tourType: true, tourStatus: true, guestKind: true, type: true, supplierStatus: true },
  });
  if (accepted && linked && visitBlocksConfirm(linked)) return { sent: false as const };
  if (!hold.repliedAt) {
    const stored = parseStoredInvitees(hold.invitees);
    const audience = accepted ? await loadConfirmPeople(hold) : stored.filter((person) => person.email.includes("@"));
    if (!accepted && audience.length) {
      const linkedVisit = await prisma.visit.findFirst({
        where: { outlookEventId: hold.eventId },
        include: { visitors: { include: { visitor: { select: { email: true } } } } },
      });
      const guests = new Set(
        (linkedVisit?.visitors || [])
          .map((link) => (link.visitor.email || "").trim().toLowerCase())
          .filter((email) => email.includes("@")),
      );
      for (let index = audience.length - 1; index >= 0; index -= 1) {
        if (guests.has(audience[index].email)) audience.splice(index, 1);
      }
    }
    const recipients = [
      { email: hold.bookedByEmail.trim().toLowerCase(), name: hold.bookedByName },
      ...audience,
    ].filter(
      (item, index, list) =>
        /@(neweast\.com|neweast\.co)$/i.test(item.email) &&
        list.findIndex((row) => row.email.toLowerCase() === item.email.toLowerCase()) === index,
    );
    for (const person of recipients) {
      await sendStaffRoomHoldEmail({
        to: person.email,
        name: person.name,
        room: hold.roomName,
        date: fmtDate(hold.startAt),
        start: fmtTime(hold.startAt),
        end: fmtTime(hold.endAt),
        subject: hold.subject,
        description: hold.description,
        accepted,
      });
    }
    await prisma.roomHold.update({
      where: { id: hold.id },
      data: { repliedAt: new Date(), roomReply: accepted ? "accepted" : "declined" },
    });
  }
  if (accepted) await confirmHoldCalendars(holdId);
  return { sent: true as const };
}

export async function sendRoomConfirmReply(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { visitors: { include: { visitor: true } }, createdBy: { select: { id: true, email: true, name: true } } },
  });
  if (!visit || visit.roomConfirmRepliedAt) return { sent: false as const };
  if (visitBlocksConfirm(visit)) return { sent: false as const };
  const guestEmails = new Set(
    visit.visitors.map((link) => (link.visitor.email || "").trim().toLowerCase()).filter((email) => email.includes("@")),
  );
  const recipients = [visit.createdBy.email.trim(), visit.emailFrom?.trim() || ""].filter(
    (email, index, list) =>
      /@(neweast\.com|neweast\.co)$/i.test(email) &&
      !guestEmails.has(email.toLowerCase()) &&
      list.findIndex((item) => item.toLowerCase() === email.toLowerCase()) === index,
  );
  if (!recipients.length) return { sent: false as const };

  const end =
    visit.expectedDeparture && visit.expectedDeparture > visit.expectedArrival
      ? visit.expectedDeparture
      : new Date(visit.expectedArrival.getTime() + 60 * 60 * 1000);
  await sendRoomConfirmEmail({
    to: recipients,
    subject: `Your meeting room is ready · ${visit.visitCode}`,
    date: fmtDate(visit.expectedArrival),
    start: fmtTime(visit.expectedArrival),
    end: fmtTime(end),
    room: visit.meetingRoom || "Meeting room",
    guests: visit.visitors.map((link) => ({
      name: link.visitor.fullName,
      company: link.visitor.company,
      jobTitle: link.visitor.jobTitle,
    })),
    guestCount: visit.visitorCount,
    visitCode: visit.visitCode,
    inReplyTo: visit.emailMessageId,
  });
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      roomConfirmRepliedAt: new Date(),
      intakeNotes: markReplyDone(visit.intakeNotes),
    },
  });
  await addTimeline({ visitId, event: "Room confirm emailed", note: "Reply done" });
  const names = visit.visitors.map((link) => link.visitor.fullName).filter(Boolean);
  await notify({
    userId: visit.createdBy.id,
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
  }).catch(() => undefined);
  await briefVisitStakeholders(visitId).catch(() => undefined);
  return { sent: true as const };
}

export async function releaseVisitConfirmations(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true, outlookEventId: true, tourType: true, tourStatus: true, guestKind: true, type: true, supplierStatus: true },
  });
  if (!visit || visitBlocksConfirm(visit)) return;
  const hold = visit.outlookEventId
    ? await prisma.roomHold.findFirst({ where: { eventId: visit.outlookEventId, cancelledAt: null } })
    : null;
  if (hold?.roomReply === "accepted") {
    await sendHoldReply(hold.id, true).catch(() => undefined);
  }
  if (!hold || hold.roomReply === "accepted") {
    await sendRoomConfirmReply(visit.id).catch(() => undefined);
  }
}

export async function flushRoomConfirmReplies(heads: InboxHead[] = []) {
  if (!graphConfigured()) return;
  const accepted = heads.filter((head) => roomMailStatus(head.subject) === "accepted");
  for (const head of accepted) {
    const code = visitCodeFromSubject(head.subject);
    if (!code) continue;
    const visit = await prisma.visit.findUnique({
      where: { visitCode: code },
      select: { id: true, roomConfirmRepliedAt: true },
    });
    if (!visit || visit.roomConfirmRepliedAt) continue;
    await sendRoomConfirmReply(visit.id).catch(() => undefined);
  }
  const pendingVisits = await prisma.visit.findMany({
    where: {
      roomConfirmRepliedAt: null,
      outlookEventId: { not: null },
    },
    select: { id: true, outlookEventId: true },
    take: 30,
  });
  for (const visit of pendingVisits) {
    if (!visit.outlookEventId) continue;
    try {
      const holdForVisit = await prisma.roomHold.findFirst({
        where: { eventId: visit.outlookEventId },
        select: { organizerEmail: true, bookedByEmail: true },
      });
      const reply = await guestEventRoomReply(
        visit.outlookEventId,
        holdForVisit ? holdOrganizer(holdForVisit) : undefined,
      );
      if (reply !== "accepted") continue;
      await sendRoomConfirmReply(visit.id);
    } catch {
      // next inbox sync retries
    }
  }
  const pendingHolds = await prisma.roomHold.findMany({
    where: { cancelledAt: null, repliedAt: null },
    select: { id: true, eventId: true, organizerEmail: true, bookedByEmail: true },
    take: 40,
  });
  for (const hold of pendingHolds) {
    try {
      const reply = await guestEventRoomReply(hold.eventId, holdOrganizer(hold));
      if (reply === "pending") continue;
      await sendHoldReply(hold.id, reply === "accepted");
    } catch {
      // next inbox sync retries
    }
  }
  const followUp = await prisma.roomHold.findMany({
    where: {
      cancelledAt: null,
      roomReply: "accepted",
      OR: [
        { bookerEventId: null },
        { repliedAt: { gte: new Date(Date.now() - 36 * 60 * 60 * 1000) } },
      ],
    },
    select: { id: true },
    take: 40,
  });
  for (const hold of followUp) {
    await confirmHoldCalendars(hold.id).catch(() => undefined);
  }
}
