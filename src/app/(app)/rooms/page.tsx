import { RoomsBoard } from "@/components/rooms-board";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { attachGuestEvents, guestMailbox, graphConfigured, roomsDaySchedule } from "@/lib/graph";
import { canManageIntake } from "@/lib/permissions";
import { flushRoomConfirmReplies, listRoomInvitePeople, roomBoardEvents } from "@/lib/room-booking";
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
  searchParams: Promise<{ date?: string; error?: string; booked?: string; cancelled?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageIntake(session.role)) redirect("/dashboard");
  const query = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date || "") ? (query.date as string) : dubaiToday();

  let rooms: Awaited<ReturnType<typeof roomsDaySchedule>> = [];
  let events: Awaited<ReturnType<typeof roomBoardEvents>> = [];
  let people: Awaited<ReturnType<typeof listRoomInvitePeople>> = [];
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
        title="Meeting rooms"
        description="Click a green slot to fill the booking card. You are the Outlook organizer. Add people who should receive the meeting on their calendars. When the room accepts, guest@ emails everyone on the booking."
      />
      {query.error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.error}
        </p>
      ) : null}
      {query.booked ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          Room booked on your Outlook calendar. Invitees receive the meeting. When the room accepts, {guestMailbox()} emails everyone on the booking.
        </p>
      ) : null}
      {query.cancelled ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          Booking cancelled.
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
        <RoomsBoard date={date} rooms={rooms} events={events} mailbox={guestMailbox()} bookerEmail={session.email} people={people} />
      )}
    </div>
  );
}
