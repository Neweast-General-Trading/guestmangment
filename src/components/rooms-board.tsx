"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { bookReceptionVisitAction, bookRoomTrialAction, cancelRoomTrialAction } from "@/app/actions";
import { CancelReasonPopup } from "@/components/cancel-visit";
import { FormBusy } from "@/components/form-busy";
import { InvitePeople } from "@/components/invite-people";
import { SearchSelect } from "@/components/search-select";
import { TourField } from "@/components/tour-field";
import { GuestDocFields } from "@/components/guest-doc-fields";
import { Button, Card, Field, TextInput, Textarea, inputClass } from "@/components/ui";
import { GIFT_TYPES } from "@/lib/arrangement-types";
import { visitHeadline } from "@/lib/format";
import { isDummyMail, roomKey, sameRoom, type GuestDayEvent, type RoomDayRow, type RoomSlot, type SlotBooking } from "@/lib/graph";
import type { RoomDeskVisit } from "@/lib/room-booking";

const FREE = "bg-[#8ec9a4] hover:bg-[#7bbc93]";
const BUSY = "bg-[#d9766c]";
const PAST = "bg-[#d7d2d2]";
const PICKED = "bg-[#5fa87a] ring-2 ring-[#2f6b45]";
const EMPTY_GUEST = { fullName: "", mobile: "", email: "", company: "", jobTitle: "", nationality: "" };

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

type MeetingGroup = "ready" | "confirmation" | "pending" | "cancelled";

function meetingGroup(event: GuestDayEvent): MeetingGroup {
  if (event.stage) return event.stage;
  if (event.cancelled || event.roomReply === "declined") return "cancelled";
  if (event.roomReply === "accepted") return "confirmation";
  return "pending";
}

function MeetingSummary({ event }: { event: GuestDayEvent }) {
  return (
    <>
      <div className="text-[13px] font-medium">{event.subject}</div>
      {event.waiting ? <div className="text-[12px] text-[var(--ink)]">{event.waiting}</div> : null}
      <div className="text-[12px] text-[var(--muted)]">
        {event.start}–{event.end} · {event.room}
      </div>
      {event.description ? <div className="mt-1 text-[12px] text-[var(--ink)]">{event.description}</div> : null}
      {event.reference ? <div className="mt-1 text-right text-[11px] text-[var(--faint)]">{event.reference}</div> : null}
    </>
  );
}

const MEETING_GROUPS: { id: MeetingGroup; title: string; hint: string }[] = [
  { id: "ready", title: "Ready", hint: "The room accepted, every requirement is done, and the invitation emails were sent." },
  { id: "confirmation", title: "Meeting room confirmed", hint: "The room accepted. Requirements are still being prepared." },
  { id: "pending", title: "Pending", hint: "Waiting for the meeting room to accept." },
  { id: "cancelled", title: "Cancelled", hint: "Cancelled or declined. The slot is free." },
];

export function RoomsBoard({
  date: initialDate,
  rooms: initialRooms,
  events: initialEvents,
  mailbox,
  bookerEmail,
  people,
  deskVisits,
  departments,
  manage = true,
}: {
  date: string;
  rooms: RoomDayRow[];
  events: GuestDayEvent[];
  mailbox: string;
  bookerEmail: string;
  people: { value: string; label: string; hint?: string }[];
  deskVisits: RoomDeskVisit[];
  departments: { id: string; name: string }[];
  manage?: boolean;
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
  const [tip, setTip] = useState<{ x: number; y: number; booking: SlotBooking; room: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visitorOpen, setVisitorOpen] = useState(false);
  const [guestMobile, setGuestMobile] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [visitTitle, setVisitTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [meetingTab, setMeetingTab] = useState<MeetingGroup>("ready");
  const meetingsByGroup = MEETING_GROUPS.map((group) => ({
    ...group,
    events: events
      .filter((event) => !isDummyMail(event.subject) && !isPastSlot(date, event.end || event.start) && meetingGroup(event) === group.id)
      .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)),
  }));
  const activeMeetings = meetingsByGroup.find((group) => group.id === meetingTab) || meetingsByGroup[0];
  const selected = deskVisits.find((item) => item.id === selectedId) || null;
  const hours = rooms[0]?.slots || [];

  function openRequest(visit: RoomDeskVisit) {
    setSelectedId(visit.id);
    setVisitorOpen(false);
    setGuestMobile(visit.guests[0]?.mobile || "");
    setGuestEmail(visit.guests[0]?.email || "");
    setVisitTitle(visit.visitTitle || "");
    setPurpose(visit.purpose || "");
    setStart(visit.arrival || "10:00");
    setEnd(addMinutes(visit.arrival || "10:00", 60));
    if (visit.proposedRoom) setRoom(visit.proposedRoom);
    if (visit.visitDate) void go(visit.visitDate);
  }

  function openVisitor(name?: string, time?: string) {
    setSelectedId(null);
    setVisitorOpen(true);
    if (name) setRoom(name);
    if (time) {
      setStart(time);
      setEnd(addMinutes(time, 60));
    }
  }

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
    if (!manage || selected) return;
    openVisitor(name, time);
  }

  return (
    <div className="space-y-5">
      <div className="min-w-0 space-y-5">
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Room availability</h2>
              <p className="text-[12px] text-[var(--muted)]">Ground-floor city rooms only. Green is free.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => go(shiftDate(date, -1))} disabled={date <= dubaiToday()} className={`${navBtn} disabled:cursor-default disabled:opacity-40`}>
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
              {manage ? (
                <button type="button" className={primaryBtn} onClick={() => openVisitor()}>
                  Visitor Book
                </button>
              ) : null}
            </div>
          </div>
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="min-w-max border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[#faf7f7]">
                  <th className="sticky left-0 z-10 min-w-40 bg-[#faf7f7] px-3 py-2 text-left font-medium text-[var(--muted)]">
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
                        {row.floor || "Ground floor"}
                      </div>
                    </td>
                    {row.slots.map((slot) => {
                      const past = isPastSlot(date, slot.time);
                      const open = slot.free && !past;
                      const bookable = open && manage;
                      const marked = bookable && room === row.name && start === slot.time;
                      return (
                        <td key={slot.time} className="p-0.5">
                          <button
                            type="button"
                            disabled={!bookable}
                            onClick={() => bookable && pick(row.name, slot.time)}
                            onMouseEnter={(event) => {
                              const booking = oursOnSlot(row, slot, events);
                              if (!booking) return setTip(null);
                              const box = event.currentTarget.getBoundingClientRect();
                              setTip({ x: box.left + box.width / 2, y: box.top, booking, room: row.name });
                            }}
                            onMouseLeave={() => setTip(null)}
                            className={`block h-8 w-9 rounded-sm ${
                              past ? `${PAST} cursor-default` : bookable ? `cursor-pointer ${marked ? PICKED : FREE}` : open ? `${FREE} cursor-default` : `${BUSY} cursor-default`
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
              <span className="h-3.5 w-3.5 rounded-sm bg-[#8ec9a4]" /> Free
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm bg-[#d9766c]" /> Booked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm bg-[#d7d2d2]" /> Past
            </span>
            {loading ? <span className="text-[var(--muted)]">Updating…</span> : null}
          </div>
        </Card>

        <Card padded={false}>
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="text-sm font-semibold">Meetings</h2>
            <p className="mt-1 text-[12px] text-[var(--muted)]">Current and upcoming only.</p>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--line)] p-2">
            {meetingsByGroup.map((group) => {
              const active = group.id === activeMeetings.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setMeetingTab(group.id)}
                  className={`inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-[13px] whitespace-nowrap ${
                    active ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "text-[var(--muted)] hover:bg-[#faf4f4]"
                  }`}
                >
                  {group.title}
                  <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] ${active ? "bg-white" : "bg-[#f4eeee]"}`}>
                    {group.events.length}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="p-3">
            <p className="text-[12px] text-[var(--muted)]">{activeMeetings.hint}</p>
            {activeMeetings.events.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-[var(--line)] px-3 py-4 text-center text-[13px] text-[var(--muted)]">None coming up.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {activeMeetings.events.map((event) => {
                  return (
                    <li key={event.id} className={`rounded-xl border border-[var(--line)] bg-[#fcfafa] px-3 py-2 ${event.href ? "hover:border-[var(--line-strong)] hover:bg-white" : ""}`}>
                      {event.href ? (
                        <Link href={event.href} className="block">
                          <MeetingSummary event={event} />
                        </Link>
                      ) : (
                        <MeetingSummary event={event} />
                      )}
                      {activeMeetings.id === "cancelled" || !manage ? null : (
                        <div className="mt-2">
                          <CancelReasonPopup
                            action={cancelRoomTrialAction}
                            fields={[
                              { name: "eventId", value: event.id },
                              { name: "date", value: date },
                            ]}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {manage ? <Card>
          <h2 className="text-sm font-semibold">Visit requests</h2>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            Employee requests waiting for a room. Open one to see every detail, fill gaps, choose a room, then submit.
          </p>
          {deskVisits.length === 0 ? (
            <p className="mt-3 text-[13px] text-[var(--muted)]">No employee visit requests waiting for a room.</p>
          ) : (
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {deskVisits.map((visit) => {
                const active = visit.id === selectedId;
                return (
                  <li key={visit.id}>
                    <button
                      type="button"
                      onClick={() => openRequest(visit)}
                      className={`w-full rounded-xl border px-3 py-2 text-left ${
                        active ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[#fcfafa] hover:bg-white"
                      }`}
                    >
                      <div className="text-[13px] font-medium">
                        {(visit.visitTitle || visit.purpose || "Guest visit").trim()} - {visit.requester}
                      </div>
                      <div className="text-[12px] text-[var(--muted)]">
                        {visit.proposedRoom
                          ? proposedRoomLabel(rooms, visit.proposedRoom, visit.arrival)
                          : "Room not set"}
                        {` · ${visit.visitDate} ${visit.arrival}`}
                      </div>
                      <div className="mt-1 text-right text-[11px] text-[var(--faint)]">{visit.visitCode}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card> : null}
      </div>

      {selected ? (
        <WideModal
          title={visitHeadline({ visitTitle: selected.visitTitle, purpose: selected.purpose, name: selected.requester })}
          onClose={() => setSelectedId(null)}
        >
          <p className="text-[13px] text-[var(--muted)]">
            From {selected.requester} · {selected.department} · {selected.guestKind}. Proposed room:{" "}
            {selected.proposedRoom ? proposedRoomLabel(rooms, selected.proposedRoom, selected.arrival) : "N/A"}.
            Reception fills anything missing, then submits. The room is asked to accept; everyone is emailed when it confirms.
          </p>
          {selected.source === "STAFF" ? (
            <div className="mt-3">
              <Button href={`/request/${selected.id}`} variant="secondary">
                Edit all details
              </Button>
            </div>
          ) : null}
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[#fcfafa] p-3 text-[13px]">
            {selected.guests.map((guest) => (
              <div key={guest.id} className="py-1">
                <span className="font-medium">{guest.fullName}</span>
                <span className="text-[var(--muted)]">
                  {" "}
                  · {guest.company || "Company not given"} · {guest.jobTitle || "Job title not given"}
                </span>
              </div>
            ))}
          </div>
          <form action={bookRoomTrialAction} encType="multipart/form-data" className="mt-4 grid gap-3 md:grid-cols-2">
            <FormBusy label="Booking…" />
            <input type="hidden" name="visitId" value={selected.id} />
            <input type="hidden" name="subject" value={visitHeadline({ visitTitle, purpose, name: selected.requester })} />
            <Field label="Guest mobile">
              <TextInput name="guestMobile" value={guestMobile} onChange={(event) => setGuestMobile(event.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Guest email">
              <TextInput name="guestEmail" type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} placeholder="Optional" />
            </Field>
            <TourField defaultValue={selected.tourType} />
            <div className="md:col-span-2">
              <Field label="Title of visit" required>
                <TextInput name="visitTitle" value={visitTitle} onChange={(event) => setVisitTitle(event.target.value)} required placeholder="Title shown on the invitation" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Visit details">
                <Textarea name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Optional" className="min-h-20" />
              </Field>
            </div>
            <RoomFields date={date} go={go} room={room} setRoom={setRoom} rooms={rooms} start={start} setStart={setStart} end={end} setEnd={setEnd} />
            <div className="md:col-span-2 space-y-3">
              {selected.guests.map((guest, index) => (
                <GuestDocFields key={guest.linkId || guest.id} index={index} guestName={guest.fullName} docs={guest.docs || selected.docs} />
              ))}
            </div>
            <div className="md:col-span-2">
              <InvitePeople
                key={selected.id}
                people={people}
                bookerEmail={bookerEmail}
                initial={selected.invitees}
                cancelVisitId={selected.id}
                hint="NEWEAST and AISIN colleagues. When Reception confirms the booking, they receive a guest visit invitation they can accept. Guests are not included."
              />
            </div>
            {isPastSlot(date, start) ? (
              <p className="md:col-span-2 text-[12px] font-medium text-[#b14a42]">Past date or time cannot be booked.</p>
            ) : null}
            <div className="md:col-span-2 flex justify-end">
              <BookSubmit locked={isPastSlot(date, start)} />
            </div>
          </form>
        </WideModal>
      ) : null}

      {visitorOpen ? (
        <WideModal title="Visitor Book" onClose={() => setVisitorOpen(false)}>
          <p className="text-[13px] text-[var(--muted)]">
            Reception books this immediately — no line-manager approval. {mailbox} sends a guest visit invitation as soon as the booking is confirmed. Guests are not included.
          </p>
          <VisitorBookForm
            date={date}
            go={go}
            room={room}
            setRoom={setRoom}
            rooms={rooms}
            start={start}
            setStart={setStart}
            end={end}
            setEnd={setEnd}
            people={people}
            bookerEmail={bookerEmail}
            departments={departments}
          />
        </WideModal>
      ) : null}

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
        </div>
      ) : null}
    </div>
  );
}

function WideModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(26,21,21,0.4)] p-4 py-8">
      <div className="w-full max-w-5xl rounded-2xl border border-[var(--line)] bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="text-[22px] leading-none text-[var(--muted)]" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function VisitorBookForm({
  date,
  go,
  room,
  setRoom,
  rooms,
  start,
  setStart,
  end,
  setEnd,
  people,
  bookerEmail,
  departments,
}: {
  date: string;
  go: (next: string) => void;
  room: string;
  setRoom: (value: string) => void;
  rooms: RoomDayRow[];
  start: string;
  setStart: (value: string) => void;
  end: string;
  setEnd: (value: string) => void;
  people: { value: string; label: string; hint?: string }[];
  bookerEmail: string;
  departments: { id: string; name: string }[];
}) {
  const [rows, setRows] = useState([{ ...EMPTY_GUEST }]);
  const [guestCount, setGuestCount] = useState(1);

  function resizeGuests(raw: number) {
    const count = Math.min(12, Math.max(1, Number.isFinite(raw) ? raw : 1));
    setGuestCount(count);
    setRows((current) => {
      const next = current.slice(0, count).map((row) => ({ ...row }));
      while (next.length < count) next.push({ ...EMPTY_GUEST });
      return next;
    });
  }

  return (
    <form action={bookReceptionVisitAction} encType="multipart/form-data" className="mt-4 space-y-4">
      <FormBusy label="Booking visitor…" />
      <input type="hidden" name="visitorRows" value={rows.length} />
      <input type="hidden" name="visitDate" value={date} />
      <div className="grid gap-3 md:grid-cols-2">
        <RoomFields date={date} go={go} room={room} setRoom={setRoom} rooms={rooms} start={start} setStart={setStart} end={end} setEnd={setEnd} />
        <Field label="Department" required>
          <SearchSelect name="departmentId" options={departments.map((item) => ({ value: item.id, label: item.name }))} placeholder="Department" required />
        </Field>
        <Field label="Guest type" required>
          <select name="guestKind" className={inputClass} defaultValue="GUEST" required>
            <option value="GUEST">Guest</option>
            <option value="CUSTOMER">Customer</option>
            <option value="SUPPLIER">Supplier</option>
            <option value="VIP">VIP</option>
          </select>
        </Field>
        <TourField />
      </div>
      <Field label="Title of visit" required>
        <TextInput name="visitTitle" required placeholder="Title shown on the invitation" />
      </Field>
      <Field label="Visit details">
        <Textarea name="purpose" placeholder="Optional" className="min-h-20" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Driver and car">
          <select name="driverRequired" className={inputClass} defaultValue="no">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
      </div>
      <div className="flex items-end justify-between gap-3">
        <h3 className="text-sm font-semibold">Guests</h3>
        <Field label="Number of guests" required>
          <TextInput name="guestCount" type="number" min={1} max={12} required value={String(guestCount)} onChange={(event) => resizeGuests(Number(event.target.value))} />
        </Field>
      </div>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-[var(--line)] bg-[#fcfafa] p-3 md:grid-cols-3">
          <Field label="Full name" required>
            <TextInput name={`fullName_${index}`} required defaultValue={row.fullName} />
          </Field>
          <Field label="Mobile">
            <TextInput name={`mobile_${index}`} placeholder="Optional" defaultValue={row.mobile} />
          </Field>
          <Field label="Email">
            <TextInput name={`email_${index}`} type="email" placeholder="Optional" defaultValue={row.email} />
          </Field>
          <TextInput name={`company_${index}`} placeholder="Company" defaultValue={row.company} />
          <TextInput name={`jobTitle_${index}`} placeholder="Job title" defaultValue={row.jobTitle} />
          <TextInput name={`nationality_${index}`} placeholder="Nationality" defaultValue={row.nationality} />
          <Field label="Gate pass">
            <select name={`gatePass_${index}`} className={inputClass} defaultValue="no">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Protocol gift">
            <select name={`gift_${index}`} className={inputClass} defaultValue="no">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Gift type">
            <select name={`giftType_${index}`} className={inputClass} defaultValue="Welcome gift">
              {GIFT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-3">
            <GuestDocFields index={index} guestName={`Guest ${index + 1}`} />
          </div>
        </div>
      ))}
      <InvitePeople
        people={people}
        bookerEmail={bookerEmail}
        hint="NEWEAST and AISIN colleagues. When Reception confirms the booking, they receive a guest visit invitation they can accept. Guests are not included."
      />
      {isPastSlot(date, start) ? <p className="text-[12px] font-medium text-[#b14a42]">Past date or time cannot be booked.</p> : null}
      <div className="flex justify-end">
        <BookSubmit locked={isPastSlot(date, start)} />
      </div>
    </form>
  );
}

function RoomFields({
  date,
  go,
  room,
  setRoom,
  rooms,
  start,
  setStart,
  end,
  setEnd,
}: {
  date: string;
  go: (next: string) => void;
  room: string;
  setRoom: (value: string) => void;
  rooms: RoomDayRow[];
  start: string;
  setStart: (value: string) => void;
  end: string;
  setEnd: (value: string) => void;
}) {
  return (
    <>
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
        <TextInput type="date" name="date" value={date} min={dubaiToday()} onChange={(event) => event.target.value && go(event.target.value)} required />
      </Field>
      <Field label="Start" required>
        <TextInput type="time" name="start" value={start} onChange={(event) => setStart(event.target.value)} required />
      </Field>
      <Field label="End" required>
        <TextInput type="time" name="end" value={end} onChange={(event) => setEnd(event.target.value)} required />
      </Field>
    </>
  );
}

function BookSubmit({ locked }: { locked?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={locked || pending}>
      {pending ? "Booking…" : locked ? "Time is in the past" : "Submit"}
    </Button>
  );
}

const navBtn =
  "inline-flex h-8 cursor-pointer items-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium hover:bg-[#faf7f7]";
const primaryBtn =
  "inline-flex h-8 cursor-pointer items-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)] hover:bg-[#f3dede]";

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function proposedRoomLabel(rooms: RoomDayRow[], name: string, time: string) {
  const row = rooms.find((item) => roomKey(item.name) === roomKey(name));
  if (!row) return name;
  const slot = row.slots.find((item) => item.time === time);
  if (slot && !slot.free) return `${name} · Already Booked`;
  return name;
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}
