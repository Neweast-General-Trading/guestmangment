import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { attachGuestEvents, roomsDaySchedule } from "@/lib/graph";
import { canManageIntake } from "@/lib/permissions";
import { flushRoomConfirmReplies, roomBoardEvents } from "@/lib/room-booking";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageIntake(session.role)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const date = new URL(request.url).searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });
  }

  await flushRoomConfirmReplies().catch(() => undefined);
  const [rooms, events] = await Promise.all([roomsDaySchedule(date), roomBoardEvents(date)]);
  return NextResponse.json({ rooms: attachGuestEvents(rooms, events), events });
}
