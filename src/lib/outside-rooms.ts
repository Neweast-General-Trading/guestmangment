import { GATE_PASS_OWNER_EMAIL } from "./arrangement-types";
import { SALMA_EMAILS } from "./constants";
import { fmtDate, fmtTime } from "./format";
import { guestMailbox, listRoomCalendarBookings, visitCodeFromSubject } from "./graph";
import { sendOutsideRoomEmail } from "./mail";
import { prisma } from "./prisma";

let lastScan = 0;

export async function notifyOutsideRoomBookings() {
  if (Date.now() - lastScan < 5 * 60 * 1000) return;
  const now = new Date();
  const from = new Date(now.getTime() - 60 * 60 * 1000);
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const events = await listRoomCalendarBookings(from, to);
  lastScan = Date.now();
  if (!events.length) return;
  const holds = await prisma.roomHold.findMany({
    where: { cancelledAt: null, startAt: { gte: from, lte: to } },
    select: { eventId: true, roomEmail: true, startAt: true },
  });
  const guest = guestMailbox().toLowerCase();
  const codes = [...new Set(events.map((event) => visitCodeFromSubject(event.subject)).filter(Boolean))] as string[];
  const knownCodes = new Set(
    codes.length
      ? (await prisma.visit.findMany({ where: { visitCode: { in: codes } }, select: { visitCode: true } })).map((row) => row.visitCode)
      : [],
  );
  for (const event of events) {
    if (event.startAt.getTime() < now.getTime() - 30 * 60 * 1000) continue;
    const created = event.createdAt.getTime();
    if (Number.isNaN(created) || created < now.getTime() - 36 * 60 * 60 * 1000) continue;
    const organizer = event.organizerEmail;
    if (!organizer || organizer === guest) continue;
    const code = visitCodeFromSubject(event.subject);
    if (code && knownCodes.has(code)) continue;
    const held = holds.some(
      (hold) =>
        hold.eventId === event.id ||
        (hold.roomEmail.toLowerCase() === event.roomEmail.toLowerCase() &&
          Math.abs(hold.startAt.getTime() - event.startAt.getTime()) < 3 * 60 * 1000),
    );
    if (held) continue;
    const seen = await prisma.outsideRoomNotice.findUnique({ where: { eventKey: event.id } });
    if (seen) continue;
    const bookedBy = event.organizerName ? `${event.organizerName} (${organizer})` : organizer;
    let notice: { id: string };
    try {
      notice = await prisma.outsideRoomNotice.create({
      data: {
        eventKey: event.id,
        roomName: event.roomName,
        startAt: event.startAt,
        endAt: event.endAt,
        organizerName: event.organizerName || organizer,
        organizerEmail: organizer,
        subject: event.subject,
      },
    });
    } catch {
      continue;
    }
    try {
      await sendOutsideRoomEmail({
        to: [GATE_PASS_OWNER_EMAIL, "sachini@neweast.com", SALMA_EMAILS[0]],
        room: event.roomName,
        when: `${fmtDate(event.startAt)} · ${fmtTime(event.startAt)}–${fmtTime(event.endAt)}`,
        bookedBy,
        subject: event.subject,
      });
    } catch {
      await prisma.outsideRoomNotice.delete({ where: { id: notice.id } }).catch(() => undefined);
    }
  }
}
