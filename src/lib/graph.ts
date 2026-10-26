import { stripHtml } from "./extract-visit";

export type GraphRoom = {
  name: string;
  email: string;
  capacity: number | null;
  floor: string;
  available: boolean;
};

export type GraphFile = {
  name: string;
  contentType: string;
  bytes: Buffer;
};

export type GraphMail = {
  id: string;
  internetMessageId: string;
  subject: string;
  from: string;
  text: string;
  files: GraphFile[];
};

function tenant() {
  return process.env.GRAPH_TENANT_ID?.trim() || "";
}

function mailbox() {
  return process.env.GRAPH_MAILBOX?.trim() || process.env.GUEST_INBOX_USER?.trim() || "guest@neweast.co";
}

export function graphConfigured() {
  return Boolean(tenant() && process.env.GRAPH_CLIENT_ID?.trim() && process.env.GRAPH_CLIENT_SECRET);
}

export function guestMailbox() {
  return mailbox();
}

export const ROOM_DAY_START = 7;
export const ROOM_DAY_END = 21;
export const ROOM_SLOT_MIN = 30;

function clockFromMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function roomDaySlots() {
  const slots: string[] = [];
  for (let minutes = ROOM_DAY_START * 60; minutes <= ROOM_DAY_END * 60; minutes += ROOM_SLOT_MIN) {
    slots.push(clockFromMinutes(minutes));
  }
  return slots;
}

export function roomDayScheduleEnd() {
  return `${clockFromMinutes(ROOM_DAY_END * 60 + ROOM_SLOT_MIN)}:00`;
}

export function roomIsFree(availabilityView?: string | null) {
  if (!availabilityView) return true;
  return !/[1-4]/.test(availabilityView);
}

let tokenCache: { value: string; until: number } | null = null;

async function graphToken() {
  if (tokenCache && tokenCache.until > Date.now() + 15_000) return tokenCache.value;
  const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GRAPH_CLIENT_ID?.trim() || "",
      client_secret: process.env.GRAPH_CLIENT_SECRET || "",
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!data.access_token) throw new Error("Microsoft Graph sign-in failed.");
  tokenCache = {
    value: data.access_token,
    until: Date.now() + Math.max(60, (data.expires_in || 3600) - 60) * 1000,
  };
  return data.access_token;
}

async function graphJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await graphToken();
  const url = path.startsWith("http") ? path : `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `Graph ${res.status}`);
  return data;
}

type PlaceRow = {
  id?: string;
  displayName?: string;
  emailAddress?: string;
  capacity?: number | null;
  floorLabel?: string;
  building?: string;
};

export async function listHqRooms(): Promise<GraphRoom[]> {
  const data = await graphJson<{ value?: PlaceRow[] }>("/places/microsoft.graph.room?$top=80");
  return (data.value || [])
    .filter((row) => {
      if (!row.displayName || !row.emailAddress) return false;
      return /negt_hq|negt hq/i.test(row.building || "");
    })
    .map((row) => ({
      name: row.displayName as string,
      email: row.emailAddress as string,
      capacity: row.capacity ?? null,
      floor: row.floorLabel || row.building || "",
      available: true,
    }));
}

function dubaiStamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

export async function roomsWithAvailability(start: Date, end: Date): Promise<GraphRoom[]> {
  const rooms = await listHqRooms();
  if (!rooms.length) return [];
  try {
    const data = await graphJson<{
      value?: {
        scheduleId?: string;
        availabilityView?: string;
        scheduleItems?: { subject?: string; status?: string }[];
      }[];
    }>(`/users/${encodeURIComponent(mailbox())}/calendar/getSchedule`, {
      method: "POST",
      body: JSON.stringify({
        schedules: rooms.map((room) => room.email),
        startTime: { dateTime: dubaiStamp(start), timeZone: "Asia/Dubai" },
        endTime: { dateTime: dubaiStamp(end), timeZone: "Asia/Dubai" },
        availabilityViewInterval: 30,
      }),
    });
    const byEmail = new Map((data.value || []).map((row) => [row.scheduleId?.toLowerCase(), row]));
    return rooms.map((room) => {
      const row = byEmail.get(room.email.toLowerCase());
      const items = row?.scheduleItems || [];
      const onlyReleased = items.length > 0 && items.every((item) => isReleasedBooking(item));
      return {
        ...room,
        available: onlyReleased || roomIsFree(row?.availabilityView),
      };
    });
  } catch {
    return rooms;
  }
}

export type RoomReply = "accepted" | "declined" | "pending";

export type SlotBooking = {
  subject: string;
  start: string;
  end: string;
  roomReply?: RoomReply;
  cancelled?: boolean;
  ours?: boolean;
  description?: string;
};

export type RoomSlot = { time: string; free: boolean; booking?: SlotBooking };

export type RoomDayRow = GraphRoom & { slots: RoomSlot[] };

export type GuestDayEvent = {
  id: string;
  subject: string;
  start: string;
  end: string;
  room: string;
  roomEmail?: string;
  roomReply: RoomReply;
  cancelled?: boolean;
  description?: string;
};

export function roomKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function sameRoom(
  left: { name?: string; email?: string },
  right: { name?: string; room?: string; email?: string; roomEmail?: string },
) {
  const leftEmail = (left.email || "").toLowerCase();
  const rightEmail = (right.email || right.roomEmail || "").toLowerCase();
  if (leftEmail && rightEmail && leftEmail === rightEmail) return true;
  const leftName = roomKey(left.name || "");
  const rightName = roomKey(right.name || right.room || "");
  return Boolean(leftName && rightName && leftName === rightName);
}

export function isReleasedBooking(item: { subject?: string; roomReply?: RoomReply; cancelled?: boolean; status?: string }) {
  if (item.cancelled || item.roomReply === "declined" || item.status === "free") return true;
  return /^(canceled|cancelled)\s*:/i.test(item.subject || "");
}

function minutesOf(value?: string) {
  const match = value?.match(/T(\d{2}):(\d{2})/) || value?.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function toDubaiClock(dateTime?: string, timeZone?: string) {
  if (!dateTime) return "";
  if (!/T/.test(dateTime) && /^\d{2}:\d{2}/.test(dateTime)) return dateTime.slice(0, 5);
  if (!timeZone || !/^utc$/i.test(timeZone)) return clockFromGraph(dateTime) || dateTime.slice(0, 5);
  const raw = dateTime.replace(/\.0+$/, "");
  const date = new Date(raw.endsWith("Z") ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return clockFromGraph(dateTime);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

export function applyScheduleItems(
  slots: RoomSlot[],
  items: {
    subject?: string;
    roomReply?: RoomReply;
    cancelled?: boolean;
    ours?: boolean;
    description?: string;
    status?: string;
    start?: { dateTime?: string; timeZone?: string };
    end?: { dateTime?: string; timeZone?: string };
  }[] = [],
) {
  for (const item of items) {
    const startClock = toDubaiClock(item.start?.dateTime, item.start?.timeZone);
    const endClock = toDubaiClock(item.end?.dateTime, item.end?.timeZone);
    const start = minutesOf(startClock);
    const end = minutesOf(endClock);
    if (start == null || end == null) continue;
    const released = isReleasedBooking(item);
    const booking: SlotBooking = {
      subject: item.subject?.trim() || "Busy",
      start: startClock,
      end: endClock,
      roomReply: item.roomReply,
      cancelled: released,
      ours: item.ours,
      description: item.description,
    };
    for (const slot of slots) {
      const [hour, minute] = slot.time.split(":").map(Number);
      const at = hour * 60 + minute;
      if (at >= start && at < end) {
        if (released) {
          if (slot.booking && !slot.booking.cancelled) continue;
          slot.free = true;
          slot.booking = booking;
        } else {
          slot.free = false;
          slot.booking = booking;
        }
      }
    }
  }
  return slots;
}

export function attachGuestEvents(rooms: RoomDayRow[], events: GuestDayEvent[]) {
  for (const event of events) {
    const room = rooms.find((row) => sameRoom(row, event));
    if (!room) continue;
    applyScheduleItems(room.slots, [
      {
        subject: event.subject,
        roomReply: event.roomReply,
        cancelled: event.cancelled,
        ours: true,
        description: event.description,
        start: { dateTime: event.start, timeZone: "Asia/Dubai" },
        end: { dateTime: event.end, timeZone: "Asia/Dubai" },
      },
    ]);
  }
  return rooms;
}

export type HqRoomBooking = {
  id: string;
  roomName: string;
  roomEmail: string;
  subject: string;
  startAt: Date;
  endAt: Date;
  cancelled?: boolean;
};

function graphDate(value?: string) {
  if (!value) return new Date(NaN);
  const raw = value.replace(/\.0+$/, "");
  if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) return new Date(raw);
  return new Date(raw);
}

export async function listHqRoomBookings(from: Date, to: Date): Promise<HqRoomBooking[]> {
  if (!graphConfigured()) return [];
  const rooms = await listHqRooms();
  if (!rooms.length) return [];
  const byEmail = new Map(rooms.map((room) => [room.email.toLowerCase(), room]));
  const out: HqRoomBooking[] = [];
  let cursor = from.getTime();
  const end = to.getTime();
  while (cursor < end) {
    const chunkEnd = new Date(Math.min(cursor + 30 * 24 * 60 * 60 * 1000, end));
    try {
      const data = await graphJson<{
        value?: {
          scheduleId?: string;
          scheduleItems?: {
            subject?: string;
            status?: string;
            start?: { dateTime?: string };
            end?: { dateTime?: string };
          }[];
        }[];
      }>(`/users/${encodeURIComponent(mailbox())}/calendar/getSchedule`, {
        method: "POST",
        body: JSON.stringify({
          schedules: rooms.map((room) => room.email),
          startTime: { dateTime: dubaiStamp(new Date(cursor)), timeZone: "Asia/Dubai" },
          endTime: { dateTime: dubaiStamp(chunkEnd), timeZone: "Asia/Dubai" },
          availabilityViewInterval: 60,
        }),
      });
      for (const row of data.value || []) {
        const room = byEmail.get((row.scheduleId || "").toLowerCase());
        for (const item of row.scheduleItems || []) {
          if (item.status === "free") continue;
          const startAt = graphDate(item.start?.dateTime);
          const endAt = graphDate(item.end?.dateTime);
          if (Number.isNaN(startAt.getTime())) continue;
          const subject = item.subject?.trim() || "Busy";
          out.push({
            id: `outlook:${row.scheduleId}:${item.start?.dateTime}:${subject}`,
            roomName: room?.name || row.scheduleId || "Room",
            roomEmail: row.scheduleId || "",
            subject,
            startAt,
            endAt,
            cancelled: /^(canceled|cancelled)\s*:/i.test(subject),
          });
        }
      }
    } catch {
      // keep holds if Outlook is unreachable
    }
    cursor = chunkEnd.getTime();
  }
  return out;
}

export async function roomsDaySchedule(date: string): Promise<RoomDayRow[]> {
  const rooms = await listHqRooms();
  const labels = roomDaySlots();
  if (!rooms.length) return [];
  const data = await graphJson<{
    value?: {
      scheduleId?: string;
      availabilityView?: string;
      scheduleItems?: { subject?: string; status?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }[];
    }[];
  }>(`/users/${encodeURIComponent(mailbox())}/calendar/getSchedule`, {
    method: "POST",
    body: JSON.stringify({
      schedules: rooms.map((room) => room.email),
      startTime: { dateTime: `${date}T${String(ROOM_DAY_START).padStart(2, "0")}:00:00`, timeZone: "Asia/Dubai" },
      endTime: { dateTime: `${date}T${roomDayScheduleEnd()}`, timeZone: "Asia/Dubai" },
      availabilityViewInterval: ROOM_SLOT_MIN,
    }),
  });
  const byEmail = new Map((data.value || []).map((row) => [row.scheduleId?.toLowerCase(), row]));
  return rooms
    .map((room) => {
      const row = byEmail.get(room.email.toLowerCase());
      const view = row?.availabilityView || "";
      const slots = labels.map((time, index) => ({
        time,
        free: !/[1-4]/.test(view[index] || "0"),
      }));
      applyScheduleItems(slots, row?.scheduleItems);
      return {
        ...room,
        available: slots.every((slot) => slot.free),
        slots,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function clockFromGraph(value?: string) {
  const match = value?.match(/T(\d{2}:\d{2})/);
  return match?.[1] || "";
}

export async function listGuestDayEvents(date: string): Promise<GuestDayEvent[]> {
  return listMailboxDayEvents(mailbox(), date);
}

export async function listMailboxDayEvents(userEmail: string, date: string): Promise<GuestDayEvent[]> {
  const box = encodeURIComponent(userEmail.trim() || mailbox());
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;
  const data = await graphJson<{
    value?: {
      id?: string;
      subject?: string;
      isCancelled?: boolean;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      location?: { displayName?: string };
      attendees?: { type?: string; status?: { response?: string }; emailAddress?: { name?: string; address?: string } }[];
    }[];
  }>(
    `/users/${box}/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$top=80&$select=id,subject,isCancelled,start,end,location,attendees&$orderby=start/dateTime`,
    { headers: { Prefer: 'outlook.timezone="Asia/Dubai"' } },
  );
  return (data.value || []).map((row) => {
    const resource = row.attendees?.find((item) => item.type === "resource");
    const subject = row.subject || "Meeting";
    return {
      id: row.id || "",
      subject,
      start: clockFromGraph(row.start?.dateTime),
      end: clockFromGraph(row.end?.dateTime),
      room: resource?.emailAddress?.name || row.location?.displayName || "Room",
      roomEmail: resource?.emailAddress?.address,
      roomReply: roomReplyFrom(resource?.status?.response),
      cancelled: Boolean(row.isCancelled) || isReleasedBooking({ subject, roomReply: roomReplyFrom(resource?.status?.response) }),
    };
  });
}

export function roomReplyFrom(value?: string): RoomReply {
  const raw = (value || "").toLowerCase();
  if (raw === "accepted" || raw === "organizer") return "accepted";
  if (raw === "declined") return "declined";
  return "pending";
}

export function isRoomReplyMail(from: string, subject: string) {
  return /^(accepted|declined|tentatively accepted)\s*:/i.test(subject.trim()) || /meetingroom|meeting.?room/i.test(from);
}

export function roomMailStatus(subject: string): RoomReply {
  const raw = subject.trim();
  if (/^declined\s*:/i.test(raw)) return "declined";
  if (/^accepted\s*:/i.test(raw)) return "accepted";
  return "pending";
}

export function roomMailTitle(subject: string) {
  return subject.replace(/^(accepted|declined|tentatively accepted)\s*:\s*/i, "").trim() || subject;
}

export function visitCodeFromSubject(subject: string) {
  const match = roomMailTitle(subject).match(/\bGV-\d{4}-\d+\b/i);
  return match?.[0]?.toUpperCase() || null;
}

export function isDummyMail(subject: string, from = "") {
  const title = roomMailTitle(subject);
  return (
    /@example\.com$/i.test(from) ||
    /confirm-check hold/i.test(title) ||
    /^guest visit room hold$/i.test(title) ||
    /^test guest visit\b/i.test(title)
  );
}

export function splitInboxHeads(heads: InboxHead[]) {
  const requests: InboxHead[] = [];
  const rooms: InboxHead[] = [];
  for (const head of heads) {
    if (isRoomReplyMail(head.from, head.subject)) rooms.push(head);
    else requests.push(head);
  }
  return { requests, rooms };
}

export async function meetingRoomOptions(): Promise<GraphRoom[]> {
  if (!graphConfigured()) return [];
  try {
    return await listHqRooms();
  } catch {
    return [];
  }
}

export function findRoomByName(rooms: GraphRoom[], name: string) {
  const needle = name.trim();
  if (!needle) return null;
  return rooms.find((room) => sameRoom(room, { name: needle })) || null;
}

export function roomEventBody(input: {
  subject: string;
  body: string;
  start: Date;
  end: Date;
  room: GraphRoom;
  attendees?: { email: string; name: string }[];
}) {
  const people = (input.attendees || []).filter((item) => item.email.includes("@"));
  return {
    subject: input.subject,
    body: { contentType: "text" as const, content: input.body },
    start: { dateTime: dubaiStamp(input.start), timeZone: "Asia/Dubai" },
    end: { dateTime: dubaiStamp(input.end), timeZone: "Asia/Dubai" },
    location: { displayName: input.room.name, locationEmailAddress: input.room.email },
    attendees: [
      {
        emailAddress: { address: input.room.email, name: input.room.name },
        type: "resource" as const,
      },
      ...people.map((item) => ({
        emailAddress: { address: item.email, name: item.name || item.email },
        type: "required" as const,
      })),
    ],
    responseRequested: true,
    allowNewTimeProposals: false,
    isReminderOn: true,
    reminderMinutesBeforeStart: 15,
  };
}

export type RoomBooking = {
  eventId: string;
  roomEmail: string;
  roomName: string;
};

export async function bookGuestRoom(input: {
  eventId?: string | null;
  organizerEmail?: string;
  roomName: string;
  start: Date;
  end: Date;
  subject: string;
  body: string;
  attendees?: { email: string; name: string }[];
}): Promise<RoomBooking> {
  if (input.start.getTime() < Date.now() - 30_000) {
    throw new Error("Room bookings cannot be in the past.");
  }
  const organizer = (input.organizerEmail || mailbox()).trim() || mailbox();
  const rooms = await listHqRooms();
  const room = findRoomByName(rooms, input.roomName);
  if (!room) throw new Error(`Outlook does not know the room “${input.roomName}”.`);
  const busy = await roomsWithAvailability(input.start, input.end);
  const slot = busy.find((item) => item.email.toLowerCase() === room.email.toLowerCase());
  // ponytail: skip free/busy when PATCHing so our own event is not treated as a conflict.
  if (slot && !slot.available && !input.eventId) {
    throw new Error(`${room.name} is busy at that time.`);
  }
  const day = dubaiStamp(input.start).slice(0, 10);
  const startClock = dubaiStamp(input.start).slice(11, 16);
  const endClock = dubaiStamp(input.end).slice(11, 16);
  const leftovers = await listMailboxDayEvents(organizer, day);
  for (const event of leftovers) {
    if (event.id === input.eventId) continue;
    if (!sameRoom(room, event)) continue;
    if (!event.cancelled && event.roomReply !== "declined") continue;
    if (event.start < endClock && event.end > startClock) await cancelGuestRoom(event.id, organizer);
  }
  const payload = roomEventBody({ ...input, room });
  const box = encodeURIComponent(organizer);
  if (input.eventId) {
    await graphJson(`/users/${box}/events/${encodeURIComponent(input.eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return { eventId: input.eventId, roomEmail: room.email, roomName: room.name };
  }
  const created = await graphJson<{ id?: string }>(`/users/${box}/events`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!created.id) throw new Error("Outlook did not return a booking id.");
  return { eventId: created.id, roomEmail: room.email, roomName: room.name };
}

export async function cancelGuestRoom(eventId: string, organizerEmail?: string) {
  const box = encodeURIComponent((organizerEmail || mailbox()).trim() || mailbox());
  const token = await graphToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${box}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message || `Graph ${res.status}`);
  }
}

function messageText(body?: { contentType?: string; content?: string }) {
  const content = body?.content || "";
  if (!content) return "";
  return (body?.contentType || "").toLowerCase() === "text" ? content : stripHtml(content);
}

async function messageFiles(messageId: string): Promise<GraphFile[]> {
  const box = encodeURIComponent(mailbox());
  const data = await graphJson<{
    value?: { id?: string; name?: string; contentType?: string }[];
  }>(`/users/${box}/messages/${messageId}/attachments?$select=id,name,contentType`);
  const files: GraphFile[] = [];
  for (const row of data.value || []) {
    if (!row.id || !/\.xlsx$/i.test(row.name || "")) continue;
    const full = await graphJson<{ name?: string; contentType?: string; contentBytes?: string }>(
      `/users/${box}/messages/${messageId}/attachments/${row.id}`,
    );
    if (!full.contentBytes) continue;
    files.push({
      name: full.name || row.name || "request.xlsx",
      contentType: full.contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes: Buffer.from(full.contentBytes, "base64"),
    });
  }
  return files;
}

export type InboxHead = {
  id: string;
  internetMessageId: string;
  subject: string;
  from: string;
  fromName: string;
  hasAttachments: boolean;
  receivedAt: string;
};

type InboxPage = {
  value?: {
    id: string;
    subject?: string;
    internetMessageId?: string;
    receivedDateTime?: string;
    hasAttachments?: boolean;
    from?: { emailAddress?: { address?: string; name?: string } };
  }[];
  "@odata.nextLink"?: string;
};

export async function listAllInboxHeads(): Promise<InboxHead[]> {
  const box = encodeURIComponent(mailbox());
  const heads: InboxHead[] = [];
  let path: string | null =
    `/users/${box}/mailFolders/inbox/messages?$top=80&$select=id,subject,from,internetMessageId,hasAttachments,receivedDateTime&$orderby=receivedDateTime desc`;
  while (path) {
    const data: InboxPage = await graphJson<InboxPage>(path);
    for (const row of data.value || []) {
      const address = row.from?.emailAddress?.address || "";
      heads.push({
        id: row.id,
        internetMessageId: row.internetMessageId || `graph-${row.id}`,
        subject: row.subject || "",
        from: address,
        fromName: row.from?.emailAddress?.name || address,
        hasAttachments: Boolean(row.hasAttachments),
        receivedAt: row.receivedDateTime || "",
      });
    }
    path = data["@odata.nextLink"] || null;
  }
  return heads;
}

export async function hydrateInboxMessage(messageId: string): Promise<Pick<GraphMail, "text" | "files">> {
  const box = encodeURIComponent(mailbox());
  const full = await graphJson<{
    body?: { contentType?: string; content?: string };
    uniqueBody?: { contentType?: string; content?: string };
    hasAttachments?: boolean;
  }>(`/users/${box}/messages/${messageId}?$select=body,uniqueBody,hasAttachments`);
  return {
    text: messageText(full.uniqueBody) || messageText(full.body),
    files: full.hasAttachments ? await messageFiles(messageId) : [],
  };
}

export async function guestEventRoomReply(eventId: string, organizerEmail?: string): Promise<RoomReply> {
  const box = encodeURIComponent((organizerEmail || mailbox()).trim() || mailbox());
  const row = await graphJson<{
    attendees?: { type?: string; status?: { response?: string } }[];
  }>(`/users/${box}/events/${encodeURIComponent(eventId)}?$select=attendees`);
  const resource = row.attendees?.find((item) => item.type === "resource");
  return roomReplyFrom(resource?.status?.response);
}

export type GraphAttendee = {
  type?: string;
  emailAddress?: { address?: string; name?: string };
  status?: { response?: string };
};

export function withRequiredAttendee(attendees: GraphAttendee[], email: string, name: string) {
  const needle = email.trim().toLowerCase();
  if (!needle) return attendees;
  if (attendees.some((item) => (item.emailAddress?.address || "").toLowerCase() === needle)) return attendees;
  return [
    ...attendees,
    {
      emailAddress: { address: email.trim(), name: name.trim() || email.trim() },
      type: "required" as const,
    },
  ];
}

export function bookerCalendarBody(input: {
  subject: string;
  description?: string;
  start: Date;
  end: Date;
  roomName: string;
  roomEmail: string;
}) {
  return {
    subject: input.subject,
    body: {
      contentType: "text" as const,
      content: [`Confirmed meeting room: ${input.roomName}`, input.description?.trim() || ""].filter(Boolean).join("\n\n"),
    },
    start: { dateTime: dubaiStamp(input.start), timeZone: "Asia/Dubai" },
    end: { dateTime: dubaiStamp(input.end), timeZone: "Asia/Dubai" },
    location: { displayName: input.roomName, locationEmailAddress: input.roomEmail },
    showAs: "busy",
    isReminderOn: true,
    reminderMinutesBeforeStart: 15,
    responseRequested: false,
  };
}

export async function readEventICalUId(eventId: string, organizerEmail?: string) {
  const box = encodeURIComponent((organizerEmail || mailbox()).trim() || mailbox());
  const event = await graphJson<{ iCalUId?: string }>(
    `/users/${box}/events/${encodeURIComponent(eventId)}?$select=id,iCalUId`,
  );
  return event.iCalUId || "";
}

export async function inviteBookerToGuestEvent(eventId: string, email: string, name: string, organizerEmail?: string) {
  const box = encodeURIComponent((organizerEmail || mailbox()).trim() || mailbox());
  const event = await graphJson<{ iCalUId?: string; attendees?: GraphAttendee[] }>(
    `/users/${box}/events/${encodeURIComponent(eventId)}?$select=id,iCalUId,attendees`,
  );
  const attendees = withRequiredAttendee(event.attendees || [], email, name);
  if (attendees.length !== (event.attendees || []).length) {
    await graphJson(`/users/${box}/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify({ attendees }),
    });
  }
  return { iCalUId: event.iCalUId || "" };
}

export async function acceptBookerMeeting(userEmail: string, iCalUId: string) {
  const email = userEmail.trim();
  const uid = iCalUId.trim();
  if (!email || !uid) return null;
  const filter = encodeURIComponent(`iCalUId eq '${uid.replace(/'/g, "''")}'`);
  const data = await graphJson<{ value?: { id?: string }[] }>(
    `/users/${encodeURIComponent(email)}/events?$filter=${filter}&$select=id&$top=1`,
  );
  const id = data.value?.[0]?.id;
  if (!id) return null;
  await graphJson(`/users/${encodeURIComponent(email)}/events/${encodeURIComponent(id)}/accept`, {
    method: "POST",
    body: JSON.stringify({ sendResponse: false }),
  });
  return id;
}

export async function createBookerCalendarEvent(
  userEmail: string,
  input: {
    subject: string;
    description?: string;
    start: Date;
    end: Date;
    roomName: string;
    roomEmail: string;
  },
) {
  const created = await graphJson<{ id?: string }>(`/users/${encodeURIComponent(userEmail.trim())}/events`, {
    method: "POST",
    body: JSON.stringify(bookerCalendarBody(input)),
  });
  if (!created.id) throw new Error("Outlook did not put the meeting on the booker's calendar.");
  return created.id;
}

export async function deleteUserCalendarEvent(userEmail: string, eventId: string) {
  const token = await graphToken();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail.trim())}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return;
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message || `Graph ${res.status}`);
  }
}
