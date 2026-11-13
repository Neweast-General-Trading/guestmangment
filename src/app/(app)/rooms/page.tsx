import { RoomsBoard } from "@/components/rooms-board";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { attachGuestEvents, guestMailbox, graphConfigured, roomsDaySchedule } from "@/lib/graph";
import { isRoomBooker, isRoomsViewer } from "@/lib/access";
import { canManageIntake, homeFor, isGatePassApprover } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { flushRoomConfirmReplies, listRoomDeskVisits, listRoomInvitePeople, roomBoardEvents } from "@/lib/room-booking";
import { redirect } from "next/navigation";

function dubaiToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string; booked?: string; cancelled?: string; files?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  const roomBooker = isRoomBooker(session.email);
  const manage = canManageIntake(session.role) || roomBooker;
  if (!manage && !isRoomsViewer(session.email)) redirect(homeFor(session.role));
  const query = await searchParams;
  const today = dubaiToday();
  const requested = /^\d{4}-\d{2}-\d{2}$/.test(query.date || "") ? (query.date as string) : today;
  const date = requested < today ? today : requested;

  let rooms: Awaited<ReturnType<typeof roomsDaySchedule>> = [];
  let events: Awaited<ReturnType<typeof roomBoardEvents>> = [];
  let people: Awaited<ReturnType<typeof listRoomInvitePeople>> = [];
  const [deskVisits, departments] = await Promise.all([
    listRoomDeskVisits(),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  let loadError = "";
  if (!graphConfigured()) {
    loadError = "Outlook is not configured.";
  } else {
    try {
      await flushRoomConfirmReplies().catch(() => undefined);
      [rooms, events, people] = await Promise.all([
        roomsDaySchedule(date),
        roomBoardEvents(date),
        listRoomInvitePeople(),
      ]);
      rooms = attachGuestEvents(rooms, events);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Could not read Outlook rooms.";
    }
  }

  return (
    <div>
      <PageHeader
        title={roomBooker && !canManageIntake(session.role) ? "Room booking" : "Meeting rooms"}
        description={
          manage
            ? "Every room on one timeline: who has it, until when, and what is free. Click free space to book. Meetings and waiting requests follow, soonest first."
            : "Every room on one timeline, and the meetings booked in each."
        }
      />
      {query.error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.error}
        </p>
      ) : null}
      {query.booked ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          Room booked. The invitation goes out when the meeting room accepts. Guests are not included.
        </p>
      ) : null}
      {query.files ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.files}
        </p>
      ) : null}
      {query.cancelled ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          Booking cancelled. Everyone on the booking was emailed.
        </p>
      ) : null}
      {loadError ? (
        <Card>
          <p className="text-sm">{loadError}</p>
        </Card>
      ) : rooms.length === 0 ? (
        <Card>
          <p className="text-sm">No HQ rooms came back from Outlook.</p>
        </Card>
      ) : (
        <RoomsBoard
          date={date}
          rooms={rooms}
          events={events}
          mailbox={guestMailbox()}
          bookerEmail={session.email}
          people={people}
          deskVisits={
            manage
              ? isGatePassApprover(session)
                ? deskVisits
                : deskVisits.map((visit) => ({
                    ...visit,
                    docs: [],
                    guests: visit.guests.map((guest) => ({ ...guest, docs: [] })),
                  }))
              : []
          }
          departments={departments}
          manage={manage}
        />
      )}
    </div>
  );
}
