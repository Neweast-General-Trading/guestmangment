import { addTimeline, writeAudit } from "./audit";
import { fmtDate, fmtTime } from "./format";
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
import { sendRoomConfirmEmail, sendStaffRoomHoldEmail } from "./mail";
import type { SessionUser } from "./permissions";
import { prisma } from "./prisma";

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
    if (visit.outlookEventId && graphConfigured()) {
      await cancelGuestRoom(visit.outlookEventId).catch(() => undefined);
    }
    if (visit.outlookEventId || visit.outlookRoomEmail) {
      await prisma.visit.update({
        where: { id: visitId },
        data: { outlookEventId: null, outlookRoomEmail: null },
      });
    }
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
    return { booked: true, roomName: booked.roomName };
  } catch (error) {
    throw new Error(bookingError(error));
  }
}

export async function releaseOutlookRoom(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { outlookEventId: true },
  });
  if (!visit?.outlookEventId || !graphConfigured()) return;
  await cancelGuestRoom(visit.outlookEventId).catch(() => undefined);
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

export async function bookStaffRoomHold(
  actor: SessionUser,
  input: { roomName: string; start: Date; end: Date; subject: string; description?: string; inviteEmails?: string[] },
) {
  const subject = input.subject.trim() || "Guest visit room hold";
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
    attendees: guests,
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
    newValue: { eventId: booked.eventId, room: booked.roomName, subject, description, invitees: guests },
  });
  return booked;
}

export async function cancelStaffRoomHold(actor: SessionUser, eventId: string) {
  const hold = await prisma.roomHold.findFirst({
    where: { eventId, cancelledAt: null },
    select: { bookedByEmail: true, bookerEventId: true, organizerEmail: true },
  });
  const organizer = hold ? holdOrganizer(hold) : guestMailbox();
  await cancelGuestRoom(eventId, organizer);
  if (hold?.bookerEventId && hold.bookerEventId !== eventId) {
    await deleteUserCalendarEvent(hold.bookedByEmail, hold.bookerEventId).catch(() => undefined);
  }
  await prisma.roomHold.updateMany({
    where: { eventId, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
  await writeAudit({
    userId: actor.id,
    action: "Room booking cancelled",
    module: "Rooms",
    previousValue: { eventId },
  });
}

async function confirmHoldCalendars(holdId: string) {
  const hold = await prisma.roomHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.cancelledAt || hold.roomReply !== "accepted") return;
  const organizer = holdOrganizer(hold);
  const booker = hold.bookedByEmail.trim().toLowerCase();
  const guests = parseStoredInvitees(hold.invitees);
  if (organizer.toLowerCase() === booker) {
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
  const iCalUId = await readEventICalUId(hold.eventId, organizer).catch(() => "");
  if (!iCalUId) return;
  for (const guest of guests) {
    await acceptBookerMeeting(guest.email, iCalUId).catch(() => undefined);
  }
}

async function sendHoldReply(holdId: string, accepted: boolean) {
  const hold = await prisma.roomHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.cancelledAt) return { sent: false as const };
  if (!hold.repliedAt) {
    const guests = parseStoredInvitees(hold.invitees);
    const recipients = [
      { email: hold.bookedByEmail.trim(), name: hold.bookedByName },
      ...guests,
    ].filter((item, index, list) => item.email.includes("@") && list.findIndex((row) => row.email.toLowerCase() === item.email.toLowerCase()) === index);
    if (!recipients.length) return { sent: false as const };
    await sendStaffRoomHoldEmail({
      to: recipients.map((person) => person.email),
      name: hold.bookedByName,
      room: hold.roomName,
      date: fmtDate(hold.startAt),
      start: fmtTime(hold.startAt),
      end: fmtTime(hold.endAt),
      subject: hold.subject,
      description: hold.description,
      accepted,
    }).catch(() => undefined);
    await prisma.roomHold.update({
      where: { id: hold.id },
      data: { repliedAt: new Date(), roomReply: accepted ? "accepted" : "declined" },
    });
  }
  if (accepted) await confirmHoldCalendars(holdId).catch(() => undefined);
  return { sent: true as const };
}

export async function sendRoomConfirmReply(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { visitors: { include: { visitor: true } }, createdBy: { select: { email: true, name: true } } },
  });
  if (!visit || visit.roomConfirmRepliedAt) return { sent: false as const };
  const to = visit.emailFrom?.trim() || visit.createdBy.email.trim();
  if (!to || !to.includes("@")) return { sent: false as const };

  const end =
    visit.expectedDeparture && visit.expectedDeparture > visit.expectedArrival
      ? visit.expectedDeparture
      : new Date(visit.expectedArrival.getTime() + 60 * 60 * 1000);
  await sendRoomConfirmEmail({
    to,
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
  return { sent: true as const };
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
      if ((await guestEventRoomReply(visit.outlookEventId)) !== "accepted") continue;
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
