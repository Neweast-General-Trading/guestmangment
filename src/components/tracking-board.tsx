import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusPill, TypeTag } from "@/components/status";
import { Card, inputClass } from "@/components/ui";
import { STATUS_LABEL, VISIT_STATUSES } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtTime, typeLabel } from "@/lib/format";
import { pageNumbers } from "@/lib/paging";
import { parseStoredInvitees } from "@/lib/room-booking";
import {
  TRACKING_PAGE_SIZE,
  TRACKING_PAGE_SIZES,
  TRACKING_TAB_LABEL,
  TRACKING_TABS,
  loadTracking,
  trackingHref,
  trackingSourceLabel,
  type TrackingQuery,
  type TrackingTab,
} from "@/lib/tracking";

type Data = Awaited<ReturnType<typeof loadTracking>>;

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function guestsOf(visit: Data["visits"][number]) {
  return visit.visitors.map((link) => link.visitor.fullName).filter(Boolean).join(", ") || `${visit.visitorCount} guest(s)`;
}

export function TrackingFilters({
  tab,
  defaults,
  roomNames = [],
  bookers = [],
}: {
  tab: TrackingTab;
  defaults: TrackingQuery;
  roomNames?: string[];
  bookers?: { email: string; name: string }[];
}) {
  return (
    <form action="/tracking" className="mb-4 grid gap-2 rounded-[10px] border border-[var(--line)] bg-white p-3 md:grid-cols-6">
      <input type="hidden" name="tab" value={tab} />
      {defaults.pageSize && defaults.pageSize !== TRACKING_PAGE_SIZE ? (
        <input type="hidden" name="pageSize" value={defaults.pageSize} />
      ) : null}
      <input name="q" defaultValue={defaults.q} placeholder="Search visitor, host, room, code, requester…" className={`${inputClass} md:col-span-2`} />
      <input type="date" name="from" defaultValue={defaults.from} className={inputClass} />
      <input type="date" name="to" defaultValue={defaults.to} className={inputClass} />
      {tab === "visits" ? (
        <select name="status" defaultValue={defaults.status ?? ""} className={inputClass}>
          <option value="">All statuses</option>
          {VISIT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      ) : null}
      {tab === "rooms" ? (
        <>
          <select name="room" defaultValue={defaults.room ?? ""} className={inputClass}>
            <option value="">All rooms</option>
            {roomNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select name="booker" defaultValue={defaults.booker ?? ""} className={inputClass}>
            <option value="">All bookers</option>
            {bookers.map((person) => (
              <option key={person.email} value={person.email}>
                {person.name}
              </option>
            ))}
          </select>
          <select name="origin" defaultValue={defaults.origin ?? ""} className={inputClass}>
            <option value="">All bookings</option>
            <option value="app">Guest app</option>
            <option value="outlook">Outlook</option>
          </select>
        </>
      ) : null}
      {tab === "services" ? (
        <select name="status" defaultValue={defaults.status ?? ""} className={inputClass}>
          <option value="">All statuses</option>
          <option value="REQUESTED">Requested</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="DONE">Done</option>
        </select>
      ) : null}
      {tab === "inbox" ? (
        <select name="kind" defaultValue={defaults.kind ?? ""} className={inputClass}>
          <option value="">All mail</option>
          <option value="request">Visit request</option>
          <option value="room">Room reply</option>
        </select>
      ) : null}
      {tab === "activity" ? (
        <select name="kind" defaultValue={defaults.kind ?? ""} className={inputClass}>
          <option value="">All modules</option>
          {["Visit Requests", "Rooms", "Assign parking", "Arrangements", "Approvals", "Email Intake", "Access", "Auth", "Screens", "Configuration"].map((module) => (
            <option key={module} value={module}>
              {module}
            </option>
          ))}
        </select>
      ) : null}
      <button className="h-9 rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] text-[13px] font-medium text-[var(--brand-ink)]" type="submit">
        Filter
      </button>
    </form>
  );
}

export function TrackingPager({
  query,
  page,
  pages,
  total,
  pageSize,
}: {
  query: TrackingQuery;
  page: number;
  pages: number;
  total: number;
  pageSize: number;
}) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  const hrefFor = (nextPage: number, size = pageSize) => trackingHref({ ...query, page: nextPage, pageSize: size });
  return (
    <nav className="mt-3 flex flex-col gap-3 rounded-[10px] border border-[var(--line)] bg-white px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[12px] text-[var(--muted)]">
          {from}–{to} of {total}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Link className={`inline-flex h-8 items-center rounded-md border px-2 text-[12px] ${page <= 1 ? "pointer-events-none opacity-40 border-[var(--line)]" : "border-[var(--line)] bg-white hover:bg-[#faf4f4]"}`} href={hrefFor(Math.max(1, page - 1))}>
            <ChevronLeft size={14} />
          </Link>
          {pageNumbers(page, pages).map((item, index) =>
            item === "…" ? (
              <span key={`gap-${index}`} className="px-1 text-[12px] text-[var(--faint)]">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={hrefFor(item)}
                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[12px] ${
                  item === page ? "border-[var(--brand)] bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#faf4f4]"
                }`}
              >
                {item}
              </Link>
            ),
          )}
          <Link className={`inline-flex h-8 items-center rounded-md border px-2 text-[12px] ${page >= pages ? "pointer-events-none opacity-40 border-[var(--line)]" : "border-[var(--line)] bg-white hover:bg-[#faf4f4]"}`} href={hrefFor(Math.min(pages, page + 1))}>
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-[12px] text-[var(--muted)]">
        <span className="mr-1">Per page</span>
        {TRACKING_PAGE_SIZES.map((size) => (
          <Link
            key={size}
            href={hrefFor(1, size)}
            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[12px] ${
              size === pageSize ? "border-[var(--brand)] bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "border-[var(--line)] bg-white hover:bg-[#faf4f4]"
            }`}
          >
            {size}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function TrackingTabs({
  tab,
  query,
}: {
  tab: TrackingTab;
  query: TrackingQuery;
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-white p-1">
      {TRACKING_TABS.map((item) => {
        const href = trackingHref({ q: query.q, from: query.from, to: query.to, tab: item, pageSize: query.pageSize });
        const active = item === tab;
        return (
          <Link
            key={item}
            href={href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-[13px] ${
              active ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {TRACKING_TAB_LABEL[item]}
          </Link>
        );
      })}
    </div>
  );
}

export function TrackingKpis({ summary }: { summary: Data["summary"] }) {
  const items = [
    ["Visits · all staff", summary.visits],
    ["Requesters", summary.requesters],
    ["Guests", summary.guests],
    ["Completed", summary.completed],
    ["Room bookings", summary.rooms],
    ["Parking", summary.parking],
    ["Gifts", summary.gifts],
    ["Guest inbox", summary.inbox],
  ] as const;
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([label, value]) => (
        <Card key={label} tone="mint">
          <div className="text-[12px] text-[var(--muted)]">{label}</div>
          <div className="mt-1 text-xl font-semibold">{value}</div>
        </Card>
      ))}
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="table-wrap overflow-x-auto rounded-[10px] border border-[var(--line)] bg-white">{children}</div>;
}

export function TrackingVisits({ visits }: { visits: Data["visits"] }) {
  if (!visits.length) return <Card><p className="text-sm text-[var(--muted)]">No visits in this range.</p></Card>;
  return (
    <Wrap>
      <table className="data">
        <thead>
          <tr>
            <th>Visit</th>
            <th>Guests</th>
            <th>Host / requester</th>
            <th>When</th>
            <th>Room</th>
            <th>Needs</th>
            <th>Gate</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit) => {
            const guest = visit.visitors[0]?.visitor;
            return (
              <tr key={visit.id}>
                <td>
                  <Link href={`/visits/${visit.id}`} className="font-medium hover:underline">
                    {visit.visitCode}
                  </Link>
                  <div className="text-[12px] text-[var(--muted)]">
                    {trackingSourceLabel(visit.source)} · {visit.department.name}
                  </div>
                  <div className="text-[12px] text-[var(--muted)]">{visit.purpose}</div>
                </td>
                <td>
                  <div className="font-medium">{guestsOf(visit)}</div>
                  <div className="text-[12px] text-[var(--muted)]">
                    {[guest?.company, guest?.email, guest?.mobile].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <TypeTag type={visit.type}>{typeLabel(visit.type)}</TypeTag>
                </td>
                <td>
                  <div>{visit.host.name}</div>
                  <div className="text-[12px] text-[var(--muted)]">Requested by {visit.createdBy.name}</div>
                  {visit.lineManager ? (
                    <div className="text-[12px] text-[var(--muted)]">Manager {visit.lineManager.name}</div>
                  ) : null}
                </td>
                <td>
                  <div>{fmtDate(visit.visitDate)}</div>
                  <div className="text-[12px] text-[var(--muted)]">
                    {fmtTime(visit.expectedArrival)}
                    {visit.expectedDeparture ? `–${fmtTime(visit.expectedDeparture)}` : ""}
                  </div>
                </td>
                <td>
                  <div>{visit.meetingRoom || visit.location || "—"}</div>
                  {visit.outlookRoomEmail ? (
                    <div className="text-[12px] text-[var(--muted)]">Outlook booked</div>
                  ) : null}
                </td>
                <td className="text-[12px] text-[var(--muted)]">
                  <div>Gift {yesNo(visit.giftRequired)}{visit.giftType ? ` · ${visit.giftType}` : ""}{visit.giftStatus ? ` · ${visit.giftStatus}` : ""}</div>
                  <div>Driver {yesNo(visit.driverRequired)}{visit.driverStatus ? ` · ${visit.driverStatus}` : ""}</div>
                  <div>Gate pass {yesNo(visit.gatePassRequired)}{visit.gatePassStatus ? ` · ${visit.gatePassStatus}` : ""}</div>
                  {visit.vehicles[0] ? <div>Vehicle {visit.vehicles[0].plate}</div> : null}
                </td>
                <td className="text-[12px] text-[var(--muted)]">
                  <div>In {fmtDateTime(visit.checkInAt)}</div>
                  <div>Out {fmtDateTime(visit.checkOutAt)}</div>
                  {visit.entryGate ? <div>{visit.entryGate}</div> : null}
                </td>
                <td>
                  <StatusPill status={visit.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Wrap>
  );
}

export function TrackingRooms({ rooms }: { rooms: Data["rooms"] }) {
  if (!rooms.length) return <Card><p className="text-sm text-[var(--muted)]">No room bookings in this range.</p></Card>;
  return (
    <Wrap>
      <table className="data">
        <thead>
          <tr>
            <th>Room</th>
            <th>When</th>
            <th>Booked by</th>
            <th>Details</th>
            <th>Invitees</th>
            <th>Source</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((row) => {
            const people = parseStoredInvitees(row.invitees);
            return (
              <tr key={row.id}>
                <td>
                  <div className="font-medium">{row.roomName}</div>
                </td>
                <td>
                  <div>{fmtDate(row.startAt)}</div>
                  <div className="text-[12px] text-[var(--muted)]">
                    {fmtTime(row.startAt)}–{fmtTime(row.endAt)}
                  </div>
                </td>
                <td>
                  <div>{row.bookedByName}</div>
                  <div className="text-[12px] text-[var(--muted)]">{row.bookedByEmail}</div>
                </td>
                <td className="text-[12px] text-[var(--muted)]">
                  <div className="font-medium text-[var(--ink)]">{row.subject || "—"}</div>
                  {row.description ? <div className="mt-0.5 whitespace-pre-wrap">{row.description}</div> : null}
                </td>
                <td className="text-[12px] text-[var(--muted)]">
                  {people.length ? people.map((item) => item.name || item.email).join(", ") : "—"}
                </td>
                <td className="text-[12px] text-[var(--muted)]">{row.origin === "outlook" ? "Outlook" : "Guest app"}</td>
                <td className="text-[12px]">
                  {row.cancelledAt ? "Cancelled" : row.roomReply || "Held"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Wrap>
  );
}

export function TrackingParking({ parking }: { parking: Data["parking"] }) {
  if (!parking.length) return <Card><p className="text-sm text-[var(--muted)]">No parking assignments in this range.</p></Card>;
  return (
    <Wrap>
      <table className="data">
        <thead>
          <tr>
            <th>Bay</th>
            <th>Employee</th>
            <th>Vehicle</th>
            <th>Assigned by</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {parking.map((row) => (
            <tr key={row.id}>
              <td className="font-medium">{row.slot}</td>
              <td>
                <div>{row.user.name}</div>
                <div className="text-[12px] text-[var(--muted)]">{row.user.email}</div>
              </td>
              <td className="text-[12px] text-[var(--muted)]">{[row.plate, row.vehicleType].filter(Boolean).join(" · ") || "—"}</td>
              <td>{row.assignedBy.name}</td>
              <td>{fmtDateTime(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Wrap>
  );
}

export function TrackingServices({ services }: { services: Data["services"] }) {
  if (!services.length) return <Card><p className="text-sm text-[var(--muted)]">No service tasks in this range.</p></Card>;
  return (
    <Wrap>
      <table className="data">
        <thead>
          <tr>
            <th>Visit</th>
            <th>Service</th>
            <th>Status</th>
            <th>Last update</th>
          </tr>
        </thead>
        <tbody>
          {services.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/visits/${row.visitId}`} className="font-medium hover:underline">
                  {row.visit.visitCode}
                </Link>
                <div className="text-[12px] text-[var(--muted)]">
                  {row.visit.visitors[0]?.visitor.fullName || "Guest"} · {row.visit.host.name}
                </div>
              </td>
              <td>{row.service.label}</td>
              <td>{row.status}</td>
              <td className="text-[12px] text-[var(--muted)]">
                {row.updates[0] ? `${row.updates[0].user.name} · ${fmtDateTime(row.updates[0].createdAt)}` : fmtDateTime(row.createdAt)}
                {row.updates[0]?.note ? <div>{row.updates[0].note}</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Wrap>
  );
}

export function TrackingActivity({ activity }: { activity: Data["activity"] }) {
  if (!activity.length) return <Card><p className="text-sm text-[var(--muted)]">No activity in this range.</p></Card>;
  return (
    <Wrap>
      <table className="data">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Action</th>
            <th>Visit</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((row) => (
            <tr key={row.id}>
              <td>{fmtDateTime(row.createdAt)}</td>
              <td>{row.user?.name || "System"}</td>
              <td>
                <div className="font-medium">{row.action}</div>
                <div className="text-[12px] text-[var(--muted)]">{row.module}</div>
              </td>
              <td>
                {row.visit ? (
                  <Link href={`/visits/${row.visit.id}`} className="hover:underline">
                    {row.visit.visitCode}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Wrap>
  );
}

export function TrackingInbox({ inbox }: { inbox: Data["inbox"] }) {
  if (!inbox.length) return <Card><p className="text-sm text-[var(--muted)]">No guest mailbox messages in this view.</p></Card>;
  return (
    <Wrap>
      <table className="data">
        <thead>
          <tr>
            <th>When</th>
            <th>From</th>
            <th>Subject</th>
            <th>Kind</th>
          </tr>
        </thead>
        <tbody>
          {inbox.map((row) => (
            <tr key={row.id}>
              <td>{row.receivedAt ? fmtDateTime(row.receivedAt) : "—"}</td>
              <td>
                <div>{row.fromName || row.from}</div>
                <div className="text-[12px] text-[var(--muted)]">{row.from}</div>
              </td>
              <td>{row.subject || "—"}</td>
              <td className="text-[12px] text-[var(--muted)]">{row.kind === "room" ? "Room reply" : "Visit request"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Wrap>
  );
}
