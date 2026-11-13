"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { bookReceptionVisitAction, bookRoomTrialAction, cancelRoomTrialAction } from "@/app/actions";
import { CancelReasonPopup } from "@/components/cancel-visit";
import { FormBusy } from "@/components/form-busy";
import { InvitePeople } from "@/components/invite-people";
import { SearchSelect } from "@/components/search-select";
import { TourField } from "@/components/tour-field";
import { GuestDocFields } from "@/components/guest-doc-fields";
import { Button, Card, Field, TextInput, Textarea, inputClass } from "@/components/ui";
import { VisitEssentials } from "@/components/visit-essentials";
import { visitHeadline } from "@/lib/format";
import { isDummyMail, roomKey, sameRoom, type GuestDayEvent, type RoomDayRow } from "@/lib/graph";
import type { RoomDeskVisit } from "@/lib/room-booking";

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

type MeetingGroup = "ready" | "confirmation" | "pending" | "cancelled";

function meetingGroup(event: GuestDayEvent): MeetingGroup {
  if (event.stage) return event.stage;
  if (event.cancelled || event.roomReply === "declined") return "cancelled";
  if (event.roomReply === "accepted") return "confirmation";
  return "pending";
}

const MEETING_GROUPS: { id: MeetingGroup; title: string; hint: string }[] = [
  { id: "ready", title: "Ready", hint: "The room accepted, every requirement is done, and the invitation emails were sent." },
  { id: "confirmation", title: "Meeting room confirmed", hint: "The room accepted. Requirements are still being prepared." },
  { id: "pending", title: "Pending", hint: "A request arrived without a room, something is still missing, or the meeting room has not accepted. Each card says why and who it is waiting on." },
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visitorOpen, setVisitorOpen] = useState(false);
  const [guestMobile, setGuestMobile] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [visitTitle, setVisitTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [meetingFilter, setMeetingFilter] = useState<MeetingFilter>("all");
  const [requestSort, setRequestSort] = useState<RequestSort>("meeting");
  const meetingsByGroup = MEETING_GROUPS.map((group) => ({
    ...group,
    events: events
      .filter((event) => !isDummyMail(event.subject) && !isPastSlot(date, event.end || event.start) && meetingGroup(event) === group.id)
      .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)),
  })).map((group) =>
    group.id === "pending"
      ? { ...group, events: [...pendingRequestEvents(deskVisits), ...group.events] }
      : group,
  );
  const sortedRequests = [...deskVisits].sort(requestSorter(requestSort));
  const selected = deskVisits.find((item) => item.id === selectedId) || null;

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

  const now = useNowClock();
  const isToday = date === dubaiToday();
  const upcomingAll = meetingsByGroup.filter((group) => group.id !== "cancelled").flatMap((group) => group.events.map((event) => ({ event, group: group.id })));
  const listed =
    meetingFilter === "all"
      ? upcomingAll.sort((a, b) => a.event.start.localeCompare(b.event.start))
      : (meetingsByGroup.find((group) => group.id === meetingFilter)?.events || []).map((event) => ({ event, group: meetingFilter }));

  return (
    <div className="space-y-5">
      <div className="min-w-0 space-y-5">
        {/* ---------- Day bar ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {nextDays(dubaiToday(), 7).map((day) => {
              const active = day.value === date;
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => go(day.value)}
                  className={`inline-flex h-9 cursor-pointer flex-col items-center justify-center rounded-lg border px-3 leading-tight ${
                    active ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-ink)]" : "border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[#faf7f7]"
                  }`}
                >
                  <span className="text-[12px] font-semibold">{day.top}</span>
                  <span className="text-[10px] text-[var(--muted)]">{day.bottom}</span>
                </button>
              );
            })}
            <input
              type="date"
              value={date}
              min={dubaiToday()}
              onChange={(event) => event.target.value && go(event.target.value)}
              className="h-9 cursor-pointer rounded-lg border border-[var(--line)] bg-white px-2 text-[12px]"
              aria-label="Pick another date"
            />
            {loading ? <span className="text-[12px] text-[var(--muted)]">Updating…</span> : null}
          </div>
          {manage ? (
            <button type="button" className={primaryBtn} onClick={() => openVisitor()}>
              + Visitor Book
            </button>
          ) : null}
        </div>

        {/* ---------- Room timeline ---------- */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Rooms · {longDay(date)}</h2>
              <p className="text-[12px] text-[var(--muted)]">
                Each bar is a booking. {manage ? "Click any free space to book that room at that time." : "Ground-floor city rooms."}
              </p>
            </div>
            <Legend />
          </div>
          <RoomTimeline
            rooms={rooms}
            events={events}
            date={date}
            now={isToday ? now : null}
            loading={loading}
            manage={manage}
            picked={{ room, start }}
            onPick={(name, time) => pick(name, time)}
          />
        </Card>

        {/* ---------- Meetings ---------- */}
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Meetings · {longDay(date)}</h2>
              <p className="text-[12px] text-[var(--muted)]">Still ahead, soonest first. Filter by where each meeting stands.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([{ id: "all", title: "All upcoming", count: upcomingAll.length }, ...meetingsByGroup.map((g) => ({ id: g.id, title: g.title, count: g.events.length }))] as {
                id: MeetingFilter;
                title: string;
                count: number;
              }[]).map((option) => {
                const active = option.id === meetingFilter;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMeetingFilter(option.id)}
                    className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12px] ${
                      active ? "border-[var(--brand)] bg-[var(--brand-soft)] font-semibold text-[var(--brand-ink)]" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#faf7f7]"
                    }`}
                  >
                    {option.id !== "all" ? <span className={`h-2 w-2 rounded-full ${STAGE_DOT[option.id as MeetingGroup]}`} /> : null}
                    {option.title}
                    <span className="tabular-nums">{option.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {meetingFilter !== "all" ? (
            <p className="px-4 pt-3 text-[12px] text-[var(--muted)]">{MEETING_GROUPS.find((g) => g.id === meetingFilter)?.hint}</p>
          ) : null}
          {listed.length === 0 ? (
            <p className="m-4 rounded-xl border border-dashed border-[var(--line)] px-3 py-5 text-center text-[13px] text-[var(--muted)]">Nothing here for this day.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {listed.map(({ event, group }) => (
                <li key={event.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 px-4 py-3 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
                  <div className="leading-tight">
                    <div className="text-[16px] font-semibold tabular-nums">{event.start || "—"}</div>
                    {event.end ? <div className="text-[11px] text-[var(--muted)] tabular-nums">to {event.end}</div> : null}
                  </div>
                  <div className="min-w-0">
                    {event.href ? (
                      <Link href={event.href} className="text-[14px] font-medium hover:underline">
                        {event.subject}
                      </Link>
                    ) : (
                      <div className="text-[14px] font-medium">{event.subject}</div>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--muted)]">
                      <span className="font-medium text-[var(--ink)]">{event.room || "Room not set"}</span>
                      {event.reference ? <span>· {event.reference}</span> : null}
                      {event.description && group === "pending" && event.id.startsWith("request-") ? <span>· {event.description}</span> : null}
                    </div>
                    {event.waiting ? <div className="mt-1.5 rounded-md bg-[var(--warn-bg)] px-2 py-1 text-[12px] text-[var(--warn)]">{event.waiting}</div> : null}
                  </div>
                  <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                    <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold whitespace-nowrap ${STAGE_PILL[group as MeetingGroup]}`}>
                      {MEETING_GROUPS.find((g) => g.id === group)?.title}
                    </span>
                    {group === "cancelled" || !manage || event.id.startsWith("request-") ? null : (
                      <CancelReasonPopup
                        action={cancelRoomTrialAction}
                        fields={[
                          { name: "eventId", value: event.id },
                          { name: "date", value: date },
                        ]}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ---------- Requests waiting for a room ---------- */}
        {manage ? (
          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Requests waiting for a room · {sortedRequests.length}</h2>
                <p className="text-[12px] text-[var(--muted)]">Open one to fill gaps, pick the room and submit.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REQUEST_SORTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRequestSort(option.id)}
                    className={`inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-[12px] ${
                      requestSort === option.id
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] font-semibold text-[var(--brand-ink)]"
                        : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#faf7f7]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {sortedRequests.length === 0 ? (
              <p className="m-4 text-[13px] text-[var(--muted)]">No requests are waiting for a room.</p>
            ) : (
              <ul className="grid gap-3 p-4 md:grid-cols-2">
                {sortedRequests.map((visit) => {
                  const title = `${(visit.visitTitle || visit.purpose || "Guest visit").trim()} - ${visit.requester}`;
                  const roomLabel = visit.proposedRoom ? proposedRoomLabel(rooms, visit.proposedRoom, visit.arrival, visit.visitDate, date) : "Room not set";
                  const clash = roomLabel.includes("Already Booked");
                  return (
                    <li key={visit.id}>
                      <button
                        type="button"
                        onClick={() => openRequest(visit)}
                        className={`flex w-full cursor-pointer gap-3 rounded-xl border p-3 text-left hover:border-[var(--line-strong)] hover:bg-white ${
                          visit.id === selectedId ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[#fcfafa]"
                        }`}
                      >
                        <div className="w-[62px] shrink-0 border-r border-[var(--line)] pr-2 leading-tight">
                          <div className="text-[11px] font-medium text-[var(--muted)]">{shortDay(visit.visitDate)}</div>
                          <div className="text-[16px] font-semibold tabular-nums">{visit.arrival || "—"}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-medium leading-snug">{title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${clash ? "bg-[#fdecea] text-[#b42318]" : "bg-[var(--tint-sky)] text-[var(--ink)]"}`}>{roomLabel}</span>
                            <span className="rounded-full bg-[#e8f1f8] px-2 py-0.5 font-medium text-[#1d4f7a]">{visit.statusLabel}</span>
                            <span className="text-[var(--faint)]">{visit.visitCode}</span>
                          </div>
                          {visit.pendingNote ? <div className="mt-1.5 text-[12px] leading-5 text-[var(--muted)]">{visit.pendingNote}</div> : null}
                          <div className="mt-1 text-[11px] text-[var(--faint)]">Submitted {visit.submittedLabel}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ) : null}
      </div>

      {selected ? (
        <WideModal
          title={visitHeadline({ visitTitle: selected.visitTitle, purpose: selected.purpose, name: selected.requester })}
          onClose={() => setSelectedId(null)}
        >
          <p className="text-[13px] text-[var(--muted)]">
            From {selected.requester} · {selected.department} · {selected.guestKind}. Proposed room:{" "}
            {selected.proposedRoom ? proposedRoomLabel(rooms, selected.proposedRoom, selected.arrival, selected.visitDate, date) : "N/A"}.
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
                hint="NEWEAST and AISIN colleagues. When the meeting room accepts, they receive the invitation. Guests are not included."
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
      <VisitEssentials />
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
          <div className="md:col-span-3">
            <GuestDocFields index={index} guestName={`Guest ${index + 1}`} />
          </div>
        </div>
      ))}
      <InvitePeople
        people={people}
        bookerEmail={bookerEmail}
        hint="NEWEAST and AISIN colleagues. When the meeting room accepts, they receive the invitation. Guests are not included."
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

const primaryBtn =
  "inline-flex h-8 cursor-pointer items-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)] hover:bg-[#f3dede]";

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

type RequestSort = "submitted" | "meeting" | "status";

const REQUEST_SORTS: { id: RequestSort; label: string }[] = [
  { id: "meeting", label: "Meeting, soonest first" },
  { id: "submitted", label: "Submitted, newest first" },
  { id: "status", label: "Status" },
];

const STATUS_RANK: Record<string, number> = {
  Preparing: 0,
  "Meeting room confirmed": 1,
  Ready: 2,
};

function requestSorter(sort: RequestSort) {
  return (left: RoomDeskVisit, right: RoomDeskVisit) => {
    if (sort === "submitted") return right.submittedAt - left.submittedAt;
    if (sort === "meeting") return left.meetingAt - right.meetingAt;
    const rank = (STATUS_RANK[left.statusLabel] ?? 9) - (STATUS_RANK[right.statusLabel] ?? 9);
    return rank || left.meetingAt - right.meetingAt;
  };
}

function pendingRequestEvents(visits: RoomDeskVisit[]): GuestDayEvent[] {
  return [...visits]
    .sort((left, right) => left.visitDate.localeCompare(right.visitDate) || left.arrival.localeCompare(right.arrival))
    .map((visit) => ({
      id: `request-${visit.id}`,
      subject: `${(visit.visitTitle || visit.purpose || "Guest visit").trim()} - ${visit.requester}`,
      start: visit.arrival,
      end: "",
      room: visit.proposedRoom || "Room not set",
      roomReply: "pending",
      stage: "pending",
      visitId: visit.id,
      href: `/intake/${visit.id}`,
      reference: visit.visitCode,
      waiting: visit.pendingNote,
      description: visit.visitDate,
    }));
}

function proposedRoomLabel(rooms: RoomDayRow[], name: string, time: string, visitDate?: string, boardDate?: string) {
  const row = rooms.find((item) => roomKey(item.name) === roomKey(name));
  if (!row || (visitDate && boardDate && visitDate !== boardDate)) return name;
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

/* ------------------------------------------------------------------ */
/* Timeline view                                                        */
/* ------------------------------------------------------------------ */

type MeetingFilter = "all" | MeetingGroup;

const STAGE_DOT: Record<MeetingGroup, string> = {
  ready: "bg-[#2d7a55]",
  confirmation: "bg-[#c08a1e]",
  pending: "bg-[#3d6a8c]",
  cancelled: "bg-[#9aa1ab]",
};

const STAGE_PILL: Record<MeetingGroup, string> = {
  ready: "bg-[#e8f5ee] text-[#2d7a55]",
  confirmation: "bg-[#faf3e3] text-[#8f6d28]",
  pending: "bg-[#e9f2f9] text-[#2f6690]",
  cancelled: "bg-[#eef0f3] text-[#5f6672]",
};

/** Bar colours: our meetings by stage, anything else booked in Outlook in rose. */
const BAR: Record<MeetingGroup | "outlook", string> = {
  ready: "bg-[#2d7a55] text-white border-[#246447]",
  confirmation: "bg-[#f3dca6] text-[#5d4510] border-[#d9b25a]",
  pending: "bg-[#dbe9f5] text-[#1d4f7a] border-[#9fc0dc] border-dashed",
  cancelled: "bg-transparent text-[var(--muted)] border-[var(--line)]",
  outlook: "bg-[#e9a49c] text-[#5a1f19] border-[#d38277]",
};

function useNowClock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(dubaiClock());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmtDay(date: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function longDay(date: string) {
  if (date === dubaiToday()) return `Today, ${fmtDay(date, { day: "2-digit", month: "short" })}`;
  if (date === shiftDate(dubaiToday(), 1)) return `Tomorrow, ${fmtDay(date, { day: "2-digit", month: "short" })}`;
  return fmtDay(date, { weekday: "long", day: "2-digit", month: "short" });
}

function shortDay(date: string) {
  if (!date) return "";
  if (date === dubaiToday()) return "Today";
  if (date === shiftDate(dubaiToday(), 1)) return "Tomorrow";
  return fmtDay(date, { weekday: "short", day: "2-digit", month: "short" });
}

function nextDays(from: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const value = shiftDate(from, i);
    return {
      value,
      top: i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmtDay(value, { weekday: "short" }),
      bottom: fmtDay(value, { day: "2-digit", month: "short" }),
    };
  });
}

function Legend() {
  const items: [string, string][] = [
    ["Ready", BAR.ready],
    ["Room confirmed", BAR.confirmation],
    ["Pending", BAR.pending],
    ["Booked in Outlook", BAR.outlook],
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-[var(--muted)]">
      {items.map(([label, cls]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-5 rounded-sm border ${cls}`} />
          {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-[var(--brand)]" />
        Now
      </span>
    </div>
  );
}

type Bar = {
  key: string;
  start: string;
  end: string;
  subject: string;
  tone: MeetingGroup | "outlook";
  href?: string;
  note?: string;
  lane: number;
  clash: boolean;
};

type Clash = { room: string; a: Bar; b: Bar };

/** Every booking in a room as a bar, our own meetings matched to their stage; overlapping bars get separate lanes. */
function roomBars(row: RoomDayRow, events: GuestDayEvent[]): { bars: Bar[]; lanes: number; clashes: Clash[] } {
  const source =
    row.bookings ??
    row.slots.filter((slot) => !slot.free && slot.booking).map((slot) => slot.booking!);
  const seen = new Set<string>();
  const bars: Bar[] = [];
  for (const b of source) {
    if (b.cancelled) continue;
    const key = `${b.start}|${b.end}|${b.subject}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ours = events.find(
      (e) => !e.cancelled && e.roomReply !== "declined" && sameRoom(row, e) && e.start === b.start && (e.end || e.start) === b.end,
    );
    bars.push({
      key,
      start: b.start,
      end: b.end,
      subject: ours?.subject || (b.subject === "Busy" ? "Booked" : b.subject),
      tone: ours ? meetingGroup(ours) : "outlook",
      href: ours?.href,
      note: ours?.reference,
      lane: 0,
      clash: false,
    });
  }
  bars.sort((x, y) => x.start.localeCompare(y.start) || y.end.localeCompare(x.end));
  // Lanes: a bar goes in the first lane whose last bar has ended.
  const laneEnds: string[] = [];
  for (const bar of bars) {
    let lane = laneEnds.findIndex((end) => end <= bar.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bar.end);
    } else laneEnds[lane] = bar.end;
    bar.lane = lane;
  }
  const clashes: Clash[] = [];
  for (let i = 0; i < bars.length; i++) {
    for (let j = i + 1; j < bars.length; j++) {
      if (bars[j].start >= bars[i].end) break;
      bars[i].clash = true;
      bars[j].clash = true;
      clashes.push({ room: row.name, a: bars[i], b: bars[j] });
    }
  }
  return { bars, lanes: Math.max(1, laneEnds.length), clashes };
}

function RoomTimeline({
  rooms,
  events,
  date,
  now,
  loading,
  manage,
  picked,
  onPick,
}: {
  rooms: RoomDayRow[];
  events: GuestDayEvent[];
  date: string;
  now: string | null;
  loading: boolean;
  manage: boolean;
  picked: { room: string; start: string };
  onPick: (room: string, time: string) => void;
}) {
  const slots = rooms[0]?.slots || [];
  if (!slots.length) return <p className="p-4 text-[13px] text-[var(--muted)]">No room data for this day.</p>;
  const dayStart = toMinutes(slots[0].time);
  const dayEnd = toMinutes(slots[slots.length - 1].time) + 30;
  const span = dayEnd - dayStart;
  const pct = (time: string) => `${(Math.min(Math.max(toMinutes(time) - dayStart, 0), span) / span) * 100}%`;
  const width = (from: string, to: string) =>
    `${(Math.max(Math.min(toMinutes(to), dayEnd) - Math.max(toMinutes(from), dayStart), 10) / span) * 100}%`;
  const nowIn = now && toMinutes(now) >= dayStart && toMinutes(now) <= dayEnd ? now : null;
  const rows = rooms.map((row) => ({ row, ...roomBars(row, events) }));
  const clashes = rows.flatMap((r) => r.clashes);
  // Our meetings the room declined or released (room panels release meetings nobody checked in to), still ahead or under way.
  const released = events.filter(
    (e) => e.roomLost && (!now || date !== dubaiToday() || (e.end || e.start) > now),
  );

  return (
    <div className={loading ? "opacity-60" : ""}>
      {clashes.length ? (
        <div role="alert" className="mx-4 mt-3 rounded-lg border border-[#f1b8b1] bg-[#fdecea] px-3 py-2 text-[12.5px] text-[#8a1c13]">
          <div className="flex items-center gap-2 font-semibold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
            {clashes.length === 1 ? "1 double-booking on this day" : `${clashes.length} double-bookings on this day`}
          </div>
          <ul className="mt-1 space-y-0.5 pl-6">
            {clashes.map((c) => (
              <li key={`${c.room}|${c.a.key}|${c.b.key}`}>
                <b>{c.room}</b>: “{c.a.subject}” {c.a.start}–{c.a.end} overlaps “{c.b.subject}” {c.b.start}–{c.b.end}
                {c.a.tone === "outlook" || c.b.tone === "outlook" ? " · one of them was booked directly in Outlook or at the room panel" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {released.length ? (
        <div role="alert" className="mx-4 mt-3 rounded-lg border border-[#f1b8b1] bg-[#fdecea] px-3 py-2 text-[12.5px] text-[#8a1c13]">
          <div className="flex items-center gap-2 font-semibold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
            {released.length === 1 ? "1 meeting lost its room" : `${released.length} meetings lost their room`}
          </div>
          <ul className="mt-1 space-y-0.5 pl-6">
            {released.map((e) => (
              <li key={e.id}>
                <b>{e.room || "Room"}</b> declined or released “{e.subject}” {e.start}–{e.end}
                {e.reference ? ` (${e.reference})` : ""}. The visit is still active, so the guests have no room in Outlook. Rebook it or move it to a free room.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* time axis: hours and half hours */}
          <div className="grid grid-cols-[190px_minmax(0,1fr)] border-b border-[var(--line)] bg-[#faf7f7]">
            <div className="px-4 py-2 text-[11px] font-medium text-[var(--muted)]">Room · now</div>
            <div className="relative h-9">
              {slots.map((s) => {
                const hour = s.time.endsWith(":00");
                return (
                  <span
                    key={s.time}
                    className={`absolute -translate-x-1/2 tabular-nums ${hour ? "top-1.5 text-[11.5px] font-semibold text-[var(--ink)]" : "top-[18px] text-[10px] text-[var(--muted)]"}`}
                    style={{ left: pct(s.time) }}
                  >
                    {hour ? s.time : ":30"}
                  </span>
                );
              })}
              {nowIn ? (
                <span className="absolute top-1 z-20 -translate-x-1/2 rounded bg-[var(--brand)] px-1.5 text-[10.5px] font-semibold text-white tabular-nums" style={{ left: pct(nowIn) }}>
                  {nowIn}
                </span>
              ) : null}
            </div>
          </div>
          {rows.map(({ row, bars, lanes, clashes: rowClashes }) => {
            const state = rowClashes.length ? { label: "Double-booked", cls: "bg-[#b42318] text-white" } : roomState(bars, nowIn);
            const laneH = 44;
            const height = 12 + lanes * laneH;
            return (
              <div key={row.email} className={`grid grid-cols-[190px_minmax(0,1fr)] border-b border-[var(--line)] last:border-b-0 ${rowClashes.length ? "bg-[#fff6f5]" : ""}`}>
                <div className="flex flex-col justify-center gap-1 px-4 py-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[14px] font-semibold text-[var(--ink)]">{row.name}</span>
                    <span className="text-[11px] text-[var(--muted)]">{row.capacity ? `${row.capacity} seats` : ""}</span>
                  </div>
                  <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.cls}`}>{state.label}</span>
                </div>
                <div className="relative" style={{ height }}>
                  {/* grid: solid on the hour, dashed on the half hour */}
                  {slots.map((s) => (
                    <span
                      key={s.time}
                      className={`absolute inset-y-0 w-px ${s.time.endsWith(":00") ? "bg-[var(--line)]" : "border-l border-dashed border-[#efe6e6]"}`}
                      style={{ left: pct(s.time) }}
                    />
                  ))}
                  {/* free half hours are clickable */}
                  {manage
                    ? row.slots.map((slot) => {
                        const past = isPastSlot(date, slot.time);
                        if (!slot.free || past) return null;
                        const marked = picked.room === row.name && picked.start === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            aria-label={`Book ${row.name} at ${slot.time}`}
                            title={`Book ${row.name} at ${slot.time}`}
                            onClick={() => onPick(row.name, slot.time)}
                            className={`absolute inset-y-1.5 cursor-pointer rounded-md transition-colors ${marked ? "bg-[#cfe9d9] ring-2 ring-[#2d7a55]" : "hover:bg-[#e8f5ee]"}`}
                            style={{ left: pct(slot.time), width: width(slot.time, addMinutes(slot.time, 30)) }}
                          />
                        );
                      })
                    : null}
                  {date === dubaiToday() && nowIn ? (
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,rgba(120,110,110,.08)_0_6px,transparent_6px_12px)]"
                      style={{ width: pct(nowIn) }}
                    />
                  ) : null}
                  {bars.map((bar) => {
                    const body = (
                      <>
                        <span className="flex items-center gap-1 truncate text-[12px] font-semibold leading-tight">
                          {bar.clash ? <span aria-label="Overlaps another booking">⚠</span> : null}
                          <span className="truncate">{bar.subject}</span>
                        </span>
                        <span className="block truncate text-[10.5px] leading-tight opacity-80 tabular-nums">
                          {bar.start}–{bar.end}
                          {bar.note ? ` · ${bar.note}` : ""}
                        </span>
                      </>
                    );
                    const cls = `absolute z-10 overflow-hidden rounded-md border px-2 py-1 ${BAR[bar.tone]} ${bar.clash ? "ring-2 ring-[#d92d20] ring-offset-1" : ""}`;
                    const style = { left: pct(bar.start), width: width(bar.start, bar.end), top: 6 + bar.lane * laneH, height: laneH - 6 };
                    const title = `${bar.subject} · ${bar.start}–${bar.end}${bar.clash ? " · overlaps another booking" : ""}`;
                    return bar.href ? (
                      <Link key={bar.key} href={bar.href} className={`${cls} hover:brightness-95`} style={style} title={title}>
                        {body}
                      </Link>
                    ) : (
                      <div key={bar.key} className={cls} style={style} title={title}>
                        {body}
                      </div>
                    );
                  })}
                  {nowIn ? <span className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-[var(--brand)]" style={{ left: pct(nowIn) }} /> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** One line per room: free or busy right now, and until when. On other days: how many bookings. */
function roomState(bars: Bar[], now: string | null) {
  const live = bars.filter((b) => b.tone !== "cancelled");
  if (!now) {
    return live.length
      ? { label: `${live.length} booking${live.length === 1 ? "" : "s"}`, cls: "bg-[var(--tint-sky)] text-[var(--muted)]" }
      : { label: "Free all day", cls: "bg-[#e8f5ee] text-[#2d7a55]" };
  }
  const current = live.find((b) => b.start <= now && now < b.end);
  if (current) {
    let until = current.end;
    for (const b of live) if (b.start <= until && b.end > until) until = b.end;
    return { label: `Busy until ${until}`, cls: "bg-[#fdecea] text-[#b42318]" };
  }
  const next = live.find((b) => b.start > now);
  return next
    ? { label: `Free until ${next.start}`, cls: "bg-[#e8f5ee] text-[#2d7a55]" }
    : { label: "Free for the rest of the day", cls: "bg-[#e8f5ee] text-[#2d7a55]" };
}
