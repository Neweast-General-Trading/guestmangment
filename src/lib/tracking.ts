import { addDays, endOfDay, startOfDay, subDays } from "date-fns";
import { listHqRoomBookings, sameRoom, type HqRoomBooking } from "./graph";
import { peekInbox } from "./inbox-sync";
import { matches } from "./paging";
import { prisma } from "./prisma";

export const TRACKING_TABS = ["visits", "rooms", "parking", "services", "activity", "inbox"] as const;
export type TrackingTab = (typeof TRACKING_TABS)[number];

export const TRACKING_TAB_LABEL: Record<TrackingTab, string> = {
  visits: "Visits",
  rooms: "Room bookings",
  parking: "Parking",
  services: "Services",
  activity: "Activity",
  inbox: "Guest inbox",
};

export type TrackingRoomRow = {
  id: string;
  roomName: string;
  subject: string;
  description: string;
  startAt: Date;
  endAt: Date;
  createdAt: Date;
  bookedByName: string;
  bookedByEmail: string;
  invitees: string;
  cancelledAt: Date | null;
  roomReply: string | null;
  origin: "app" | "outlook";
};

export type TrackingInboxRow = {
  id: string;
  subject: string;
  from: string;
  fromName: string;
  receivedAt: string;
  kind: "request" | "room";
};

export function trackingTab(value?: string | null): TrackingTab {
  return TRACKING_TABS.includes(value as TrackingTab) ? (value as TrackingTab) : "visits";
}

export function trackingSourceLabel(source: string) {
  if (source === "STAFF") return "Staff request";
  if (source === "EMAIL") return "Email";
  if (source === "WALK_IN") return "Walk-in";
  if (source === "ADMIN") return "Administration";
  return source || "Portal";
}

function dayStart(value?: string) {
  return value ? startOfDay(new Date(`${value}T00:00:00`)) : null;
}

function dayEnd(value?: string) {
  return value ? endOfDay(new Date(`${value}T00:00:00`)) : null;
}

export function inTrackingRange(date: Date | string | null | undefined, from?: string, to?: string) {
  if (!date) return !from && !to;
  const value = new Date(date).getTime();
  const start = dayStart(from);
  const end = dayEnd(to);
  if (start && value < start.getTime()) return false;
  if (end && value > end.getTime()) return false;
  return true;
}

export function outlookWindow(from?: string, to?: string) {
  return {
    start: from ? dayStart(from)! : startOfDay(subDays(new Date(), 60)),
    end: to ? dayEnd(to)! : endOfDay(addDays(new Date(), 14)),
  };
}

export function mergeTrackingRooms(
  holds: Array<{
    id: string;
    roomName: string;
    roomEmail?: string | null;
    subject: string;
    description?: string | null;
    startAt: Date;
    endAt: Date;
    createdAt?: Date | null;
    bookedByName: string;
    bookedByEmail: string;
    invitees: string;
    cancelledAt: Date | null;
    roomReply: string | null;
  }>,
  outlook: HqRoomBooking[],
): TrackingRoomRow[] {
  const rows: TrackingRoomRow[] = holds.map((row) => ({
    id: row.id,
    roomName: row.roomName,
    subject: row.subject,
    description: (row.description || "").trim(),
    startAt: row.startAt,
    endAt: row.endAt,
    createdAt: row.createdAt || row.startAt,
    bookedByName: row.bookedByName,
    bookedByEmail: row.bookedByEmail,
    invitees: row.invitees,
    cancelledAt: row.cancelledAt,
    roomReply: row.roomReply,
    origin: "app",
  }));
  for (const item of outlook) {
    const matched = holds.some(
      (row) =>
        sameRoom({ name: row.roomName, email: row.roomEmail || "" }, { name: item.roomName, roomEmail: item.roomEmail }) &&
        Math.abs(row.startAt.getTime() - item.startAt.getTime()) < 3 * 60 * 1000,
    );
    if (matched) continue;
    rows.push({
      id: item.id,
      roomName: item.roomName,
      subject: item.subject,
      description: "",
      startAt: item.startAt,
      endAt: item.endAt,
      createdAt: item.startAt,
      bookedByName: "Outlook",
      bookedByEmail: item.roomEmail,
      invitees: "[]",
      cancelledAt: item.cancelled ? item.startAt : null,
      roomReply: item.cancelled ? "declined" : "accepted",
      origin: "outlook",
    });
  }
  return newestFirst(rows, (row) => row.createdAt.getTime() || row.startAt.getTime());
}

function newestFirst<T>(rows: T[], time: (row: T) => number) {
  return [...rows].sort((a, b) => time(b) - time(a) || 0);
}

export const TRACKING_PAGE_SIZE = 20;
export const TRACKING_PAGE_SIZES = [10, 20, 50] as const;

export type TrackingQuery = {
  tab?: string;
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  origin?: string;
  room?: string;
  booker?: string;
  kind?: string;
  page?: number;
  pageSize?: number;
};

export function parseTrackingPage(value?: string | null) {
  const page = Number(value);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

export function parseTrackingPageSize(value?: string | null) {
  const size = Number(value);
  return (TRACKING_PAGE_SIZES as readonly number[]).includes(size) ? size : TRACKING_PAGE_SIZE;
}

export function trackingHref(input: TrackingQuery) {
  const next = new URLSearchParams();
  if (input.tab && input.tab !== "visits") next.set("tab", input.tab);
  if (input.q) next.set("q", input.q);
  if (input.from) next.set("from", input.from);
  if (input.to) next.set("to", input.to);
  if (input.status) next.set("status", input.status);
  if (input.origin) next.set("origin", input.origin);
  if (input.room) next.set("room", input.room);
  if (input.booker) next.set("booker", input.booker);
  if (input.kind) next.set("kind", input.kind);
  if (input.page && input.page > 1) next.set("page", String(input.page));
  if (input.pageSize && input.pageSize !== TRACKING_PAGE_SIZE) next.set("pageSize", String(input.pageSize));
  const query = next.toString();
  return query ? `/tracking?${query}` : "/tracking";
}

export async function loadTracking(filters: TrackingQuery) {
  const q = filters.q?.trim() || "";
  const tab = trackingTab(filters.tab);
  const window = outlookWindow(filters.from, filters.to);
  const [visits, rooms, parking, tasks, activity, outlook, inbox] = await Promise.all([
    prisma.visit.findMany({
      include: {
        host: true,
        createdBy: true,
        lineManager: true,
        department: true,
        visitors: { include: { visitor: true } },
        vehicles: true,
        serviceTasks: { include: { service: true } },
        checkInBy: true,
        checkOutBy: true,
      },
      orderBy: [{ createdAt: "desc" }, { visitDate: "desc" }],
    }),
    prisma.roomHold.findMany({
      include: { bookedBy: true },
      orderBy: [{ createdAt: "desc" }, { startAt: "desc" }],
    }),
    prisma.parkingAssignment.findMany({
      include: { user: true, assignedBy: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.visitServiceTask.findMany({
      include: {
        service: true,
        visit: { include: { visitors: { include: { visitor: true }, take: 1 }, host: true } },
        updates: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      include: { user: true, visit: { select: { id: true, visitCode: true } } },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
    tab === "rooms" ? listHqRoomBookings(window.start, window.end).catch(() => []) : Promise.resolve([]),
    tab === "inbox"
      ? peekInbox()
          .then((box) => [
            ...box.requests.map((item) => ({ ...item, kind: "request" as const })),
            ...box.rooms.map((item) => ({ ...item, kind: "room" as const })),
          ])
          .catch(() => [] as TrackingInboxRow[])
      : Promise.resolve([] as TrackingInboxRow[]),
  ]);

  const visitRows = newestFirst(
    visits.filter((visit) => {
      if (filters.status && visit.status !== filters.status) return false;
      if (!inTrackingRange(visit.visitDate, filters.from, filters.to)) return false;
      if (!q) return true;
      const guests = visit.visitors.map((link) => `${link.visitor.fullName} ${link.visitor.company} ${link.visitor.email} ${link.visitor.mobile}`).join(" ");
      return matches(
        `${visit.visitCode} ${visit.purpose} ${visit.status} ${visit.type} ${visit.source} ${visit.host.name} ${visit.createdBy.name} ${visit.department.name} ${visit.meetingRoom} ${guests}`,
        q,
      );
    }),
    (visit) => visit.createdAt.getTime(),
  );

  const mergedRooms = mergeTrackingRooms(
    rooms.map((row) => ({
      id: row.id,
      roomName: row.roomName,
      roomEmail: row.roomEmail,
      subject: row.subject,
      description: row.description,
      startAt: row.startAt,
      endAt: row.endAt,
      createdAt: row.createdAt,
      bookedByName: row.bookedByName,
      bookedByEmail: row.bookedByEmail,
      invitees: row.invitees,
      cancelledAt: row.cancelledAt,
      roomReply: row.roomReply,
    })),
    outlook,
  );
  const roomNames = [...new Set(mergedRooms.map((row) => row.roomName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const bookers = [
    ...new Map(
      mergedRooms
        .filter((row) => row.origin === "app" && row.bookedByEmail)
        .map((row) => [row.bookedByEmail.toLowerCase(), { email: row.bookedByEmail, name: row.bookedByName }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
  const roomRows = newestFirst(
    mergedRooms.filter((row) => {
    if (filters.origin && row.origin !== filters.origin) return false;
    if (filters.room && row.roomName !== filters.room) return false;
    if (filters.booker && row.bookedByEmail.toLowerCase() !== filters.booker.toLowerCase()) return false;
    if ((filters.from || filters.to) && !inTrackingRange(row.startAt, filters.from, filters.to)) return false;
    if (!q) return true;
    return matches(
      `${row.roomName} ${row.subject} ${row.description} ${row.bookedByName} ${row.bookedByEmail} ${row.invitees} ${row.roomReply}`,
      q,
    );
    }),
    (row) => row.createdAt.getTime() || row.startAt.getTime(),
  );

  const parkingRows = newestFirst(
    parking.filter((row) => {
      if (!inTrackingRange(row.createdAt, filters.from, filters.to)) return false;
      if (!q) return true;
      return matches(`${row.slot} ${row.user.name} ${row.user.email} ${row.assignedBy.name} ${row.plate} ${row.vehicles}`, q);
    }),
    (row) => row.createdAt.getTime(),
  );

  const serviceRows = newestFirst(
    tasks.filter((row) => {
      if (filters.status && row.status !== filters.status) return false;
      if (!inTrackingRange(row.createdAt, filters.from, filters.to)) return false;
      if (!q) return true;
      return matches(
        `${row.service.label} ${row.status} ${row.visit.visitCode} ${row.visit.host.name} ${row.visit.visitors[0]?.visitor.fullName || ""}`,
        q,
      );
    }),
    (row) => row.createdAt.getTime(),
  );

  const activityRows = newestFirst(
    activity.filter((row) => {
      if (filters.kind && row.module !== filters.kind) return false;
      if (!inTrackingRange(row.createdAt, filters.from, filters.to)) return false;
      if (!q) return true;
      return matches(`${row.action} ${row.module} ${row.user?.name || ""} ${row.visit?.visitCode || ""} ${row.newValue || ""}`, q);
    }),
    (row) => row.createdAt.getTime(),
  );

  const guests = visitRows.reduce((sum, visit) => sum + Math.max(visit.visitorCount, visit.visitors.length), 0);
  const requesters = new Set(visitRows.map((visit) => visit.createdBy.email.toLowerCase()));
  const inboxRows = newestFirst(
    inbox.filter((row) => {
      if (filters.kind && row.kind !== filters.kind) return false;
      if (!q) return true;
      return matches(`${row.subject} ${row.from} ${row.fromName} ${row.kind}`, q);
    }),
    (row) => (row.receivedAt ? new Date(row.receivedAt).getTime() : 0),
  );
  return {
    summary: {
      visits: visitRows.length,
      guests,
      requesters: requesters.size,
      rooms: roomRows.length,
      parking: parkingRows.length,
      gifts: visitRows.filter((visit) => visit.giftRequired).length,
      gatePasses: visitRows.filter((visit) => visit.gatePassRequired).length,
      drivers: visitRows.filter((visit) => visit.driverRequired).length,
      inside: visitRows.filter((visit) => ["CHECKED_IN", "CURRENTLY_INSIDE", "IN_MEETING", "OVERDUE"].includes(visit.status)).length,
      completed: visitRows.filter((visit) => ["CHECKED_OUT", "COMPLETED"].includes(visit.status)).length,
      inbox: inboxRows.length,
    },
    visits: visitRows,
    rooms: roomRows,
    parking: parkingRows,
    services: serviceRows,
    activity: activityRows,
    inbox: inboxRows,
    roomNames,
    bookers,
  };
}
