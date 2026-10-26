"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { bookRoomTrialAction, cancelRoomTrialAction } from "@/app/actions";
import { Button, Card, Field, TextInput, Textarea, inputClass } from "@/components/ui";
import { isDummyMail, sameRoom, type GuestDayEvent, type RoomDayRow, type RoomReply, type RoomSlot, type SlotBooking } from "@/lib/graph";
import { matches } from "@/lib/paging";

const FREE = "bg-[#8ec9a4] hover:bg-[#7bbc93]";
const BUSY = "bg-[#d9766c]";
const PAST = "bg-[#d7d2d2]";
const PICKED = "bg-[#5fa87a] ring-2 ring-[#2f6b45]";

function dubaiToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dubaiClock() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

function isPastSlot(date: string, time: string) {
  const today = dubaiToday();
  return date < today || (date === today && time < dubaiClock());
}

function oursOnSlot(row: RoomDayRow, slot: RoomSlot, events: GuestDayEvent[]) {
  if (slot.booking?.ours) return slot.booking;
  const hit = events.find((event) => {
    if (event.cancelled || event.roomReply === "declined") return false;
    if (!sameRoom(row, event)) return false;
    return slot.time >= event.start && slot.time < event.end;
  });
  if (!hit) return null;
  return {
    subject: hit.subject,
    start: hit.start,
    end: hit.end,
    roomReply: hit.roomReply,
    ours: true,
    description: hit.description,
  } satisfies SlotBooking;
}

function replyLabel(reply?: RoomReply, cancelled?: boolean) {
  if (cancelled && reply !== "declined") return "Cancelled — slot is free to book";
  if (reply === "accepted") return "Meeting room confirmed";
  if (reply === "declined") return "Meeting room declined — slot is free to book";
  if (reply === "pending") return "Waiting for meeting room";
  return "";
}

export function RoomsBoard({
  date: initialDate,
  rooms: initialRooms,
  events: initialEvents,
  mailbox,
  bookerEmail,
  people,
}: {
  date: string;
  rooms: RoomDayRow[];
  events: GuestDayEvent[];
  mailbox: string;
  bookerEmail: string;
  people: { value: string; label: string; hint?: string }[];
}) {
  const cache = useRef(new Map<string, { rooms: RoomDayRow[]; events: GuestDayEvent[] }>([
    [initialDate, { rooms: initialRooms, events: initialEvents }],
  ]));
  const [date, setDate] = useState(initialDate);
  const [rooms, setRooms] = useState(initialRooms);
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState(initialRooms[0]?.name || "");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [subject, setSubject] = useState(initialRooms[0]?.name ? `Guest visit · ${initialRooms[0].name}` : "Guest visit");
  const [description, setDescription] = useState("");
  const shownEvents = events
    .filter((event) => !isDummyMail(event.subject))
    .slice()
    .sort((a, b) => b.start.localeCompare(a.start) || b.end.localeCompare(a.end));
  const [tip, setTip] = useState<{ x: number; y: number; booking: SlotBooking; room: string } | null>(null);

  const hours = rooms[0]?.slots || [];

  async function go(next: string) {
    if (next === date && cache.current.has(next)) return;
    setDate(next);
    const hit = cache.current.get(next);
    if (hit) {
      setRooms(hit.rooms);
      setEvents(hit.events);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/day?date=${next}`, { credentials: "same-origin" });
      const data = (await res.json()) as { rooms?: RoomDayRow[]; events?: GuestDayEvent[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load rooms.");
      const payload = { rooms: data.rooms || [], events: data.events || [] };
      cache.current.set(next, payload);
      setRooms(payload.rooms);
      setEvents(payload.events);
    } finally {
      setLoading(false);
    }
  }

  function pick(name: string, time: string) {
    setRoom(name);
    setStart(time);
    setEnd(addMinutes(time, 60));
    setSubject(`Guest visit · ${name}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => go(shiftDate(date, -1))} className={navBtn}>
          Previous
        </button>
        <input
          type="date"
          value={date}
          min={dubaiToday()}
          onChange={(event) => go(event.target.value)}
          className="h-8 cursor-pointer rounded-md border border-[var(--line)] bg-white px-2 text-[12px]"
        />
        <button type="button" onClick={() => go(shiftDate(date, 1))} className={navBtn}>
          Next
        </button>
        {loading ? <span className="text-[12px] text-[var(--muted)]">Updating…</span> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <Card padded={false} className="relative overflow-hidden">
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="min-w-max border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[#faf7f7]">
                  <th className="sticky left-0 z-10 min-w-48 bg-[#faf7f7] px-3 py-2 text-left font-medium text-[var(--muted)]">
                    Room
                  </th>
                  {hours.map((slot) => (
                    <th key={slot.time} className="w-10 px-0 py-2 text-center font-semibold text-[var(--ink)]">
                      {slot.time.endsWith(":00") ? slot.time.slice(0, 2) : "·"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((row) => (
                  <tr key={row.email} className="border-b border-[var(--line)]">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                      <div className="font-medium text-[12px] text-[var(--ink)]">{row.name}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {row.capacity ? `${row.capacity} · ` : ""}
                        {row.floor || "Dubai"}
                      </div>
                    </td>
                    {row.slots.map((slot) => {
                      const past = isPastSlot(date, slot.time);
                      const open = slot.free && !past;
                      const selected = open && room === row.name && start === slot.time;
                      return (
                        <td key={slot.time} className="p-0.5">
                          <button
                            type="button"
                            disabled={!open}
                            onClick={() => open && pick(row.name, slot.time)}
                            onMouseEnter={(event) => {
                              const booking = oursOnSlot(row, slot, events);
                              if (!booking) return setTip(null);
                              const box = event.currentTarget.getBoundingClientRect();
                              setTip({
                                x: box.left + box.width / 2,
                                y: box.top,
                                booking,
                                room: row.name,
                              });
                            }}
                            onMouseLeave={() => setTip(null)}
                            title={past ? `${row.name} ${slot.time} · Past` : open ? `${row.name} ${slot.time} · Free` : undefined}
                            className={`block h-8 w-9 rounded-sm ${
                              past
                                ? `${PAST} cursor-default`
                                : open
                                  ? `cursor-pointer ${selected ? PICKED : FREE}`
                                  : `${BUSY} cursor-default`
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-[var(--line)] px-3 py-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm bg-[#8ec9a4]" /> Free — click to set the booking card
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm bg-[#d9766c]" /> Booked — hover for details if booked from here
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm bg-[#d7d2d2]" /> Past — cannot book
            </span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold">Booking card</h2>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              You ({bookerEmail}) are the Outlook organizer — not {mailbox}. Invite colleagues so the meeting lands on their calendars. When the room accepts, {mailbox} emails everyone on the booking.
            </p>
            <form action={bookRoomTrialAction} className="mt-4 space-y-3">
              <Field label="Room" required>
                <select name="roomName" value={room} onChange={(event) => setRoom(event.target.value)} className={inputClass} required>
                  {rooms.map((item) => (
                    <option key={item.email} value={item.name}>
                      {item.name}
                      {item.capacity ? ` · ${item.capacity}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date" required>
                <TextInput
                  type="date"
                  name="date"
                  value={date}
                  min={dubaiToday()}
                  onChange={(event) => event.target.value && go(event.target.value)}
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start" required>
                  <TextInput type="time" name="start" value={start} onChange={(event) => setStart(event.target.value)} required />
                </Field>
                <Field label="End" required>
                  <TextInput type="time" name="end" value={end} onChange={(event) => setEnd(event.target.value)} required />
                </Field>
              </div>
              <Field label="Subject" required>
                <TextInput name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} required />
              </Field>
              <Field label="Description">
                <Textarea
                  name="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Who is meeting, agenda, or anything the room should know"
                  className="min-h-20"
                />
              </Field>
              <InvitePeople people={people} bookerEmail={bookerEmail} />
              {isPastSlot(date, start) ? (
                <p className="text-[12px] font-medium text-[#b14a42]">Past date or time cannot be booked.</p>
              ) : null}
              <BookSubmit locked={isPastSlot(date, start)} />
            </form>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">Meetings we created</h2>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              Meetings booked from this page for this day. Cancel deletes that Outlook booking.
            </p>
            {shownEvents.length === 0 ? (
              <p className="mt-2 text-[12px] text-[var(--muted)]">Nothing booked from here on this day.</p>
            ) : (
              <ul className="mt-3 max-h-[min(50vh,28rem)] space-y-2 overflow-y-auto overscroll-contain pr-1">
                {shownEvents.map((event) => (
                  <li key={event.id} className="rounded-xl border border-[var(--line)] bg-[#fcfafa] px-3 py-2">
                    <div className="text-[13px] font-medium">{event.subject}</div>
                    <div className="text-[12px] text-[var(--muted)]">
                      {event.start}–{event.end} · {event.room}
                    </div>
                    {event.description ? <div className="mt-1 text-[12px] text-[var(--ink)]">{event.description}</div> : null}
                    {replyLabel(event.roomReply, event.cancelled) ? (
                      <div className={`mt-1 text-[12px] font-medium ${event.roomReply === "accepted" && !event.cancelled ? "text-[#2f7d6d]" : event.roomReply === "declined" || event.cancelled ? "text-[#5f6672]" : "text-[#9a6b20]"}`}>
                        {replyLabel(event.roomReply, event.cancelled)}
                      </div>
                    ) : null}
                    <form action={cancelRoomTrialAction} className="mt-2">
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="date" value={date} />
                      <button type="submit" className="cursor-pointer text-[12px] font-medium text-[#b14a42]">
                        Cancel booking
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {tip ? (
        <div
          className="pointer-events-none fixed z-50 w-64 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[12px] shadow-md"
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="font-medium text-[var(--ink)]">{tip.booking.subject}</div>
          <div className="mt-0.5 text-[var(--muted)]">
            {tip.room} · {tip.booking.start}–{tip.booking.end}
          </div>
          {tip.booking.description ? <div className="mt-1 text-[var(--ink)]">{tip.booking.description}</div> : null}
          {replyLabel(tip.booking.roomReply, tip.booking.cancelled) ? (
            <div
              className={`mt-1 font-medium ${
                tip.booking.cancelled || tip.booking.roomReply === "declined"
                  ? "text-[#5f6672]"
                  : tip.booking.roomReply === "accepted"
                    ? "text-[#2f7d6d]"
                    : "text-[#9a6b20]"
              }`}
            >
              {replyLabel(tip.booking.roomReply, tip.booking.cancelled)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InvitePeople({
  people,
  bookerEmail,
}: {
  people: { value: string; label: string; hint?: string }[];
  bookerEmail: string;
}) {
  const booker = bookerEmail.trim().toLowerCase();
  const [picked, setPicked] = useState<{ email: string; name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = new Set(picked.map((item) => item.email));
  const options = people.filter((item) => {
    const email = item.value.trim().toLowerCase();
    return email.includes("@") && email !== booker && !chosen.has(email);
  });
  const filtered = options.filter((item) => matches(`${item.label} ${item.hint ?? ""} ${item.value}`, query)).slice(0, 8);

  function add(email: string, name: string) {
    const value = email.trim().toLowerCase();
    if (!value.includes("@") || value === booker || chosen.has(value) || picked.length >= 20) return;
    setPicked((current) => [...current, { email: value, name: name.trim() || value.split("@")[0] || value }]);
    setQuery("");
    setOpen(false);
  }

  function addTyped() {
    for (const part of query.split(/[\s,;]+/)) add(part, "");
  }

  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">Invite people</div>
      <p className="mb-2 text-[11px] text-[var(--muted)]">Optional. They get the Outlook meeting now, and an email from guest@ when the room confirms.</p>
      {picked.length ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {picked.map((item) => (
            <span key={item.email} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[#faf7f7] px-2 py-0.5 text-[11px]">
              {item.name}
              <button
                type="button"
                className="cursor-pointer text-[var(--muted)] hover:text-[#b14a42]"
                onClick={() => setPicked((current) => current.filter((row) => row.email !== item.email))}
                aria-label={`Remove ${item.name}`}
              >
                ×
              </button>
              <input type="hidden" name="inviteEmail" value={item.email} />
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <input
          className={inputClass}
          value={query}
          placeholder="Name or email"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (filtered[0] && !query.includes("@")) add(filtered[0].value, filtered[0].label);
            else addTyped();
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
        {open && (filtered.length || query.includes("@")) ? (
          <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-[0_12px_32px_rgba(26,21,21,0.12)]">
            {filtered.map((item) => (
              <button
                key={item.value}
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#faf4f4]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(item.value, item.label)}
              >
                <span className="block font-medium">{item.label}</span>
                {item.hint ? <span className="block text-[12px] text-[var(--muted)]">{item.hint}</span> : null}
              </button>
            ))}
            {query.includes("@") ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#faf4f4]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={addTyped}
              >
                Add {query.trim()}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BookSubmit({ locked }: { locked?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={locked || pending}>
      {pending ? "Booking…" : locked ? "Time is in the past" : "Book in Outlook"}
    </Button>
  );
}

const navBtn =
  "inline-flex h-8 cursor-pointer items-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium hover:bg-[#faf7f7]";

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}
