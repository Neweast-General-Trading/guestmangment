import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { graphConfigured, listHqRooms, roomsWithAvailability } from "@/lib/graph";
import { combineVisitDateTime } from "@/lib/visit-schedule";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ rooms: [] }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";
  const time = url.searchParams.get("time") || "09:30";
  const start = date ? combineVisitDateTime(date, time) : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  if (!graphConfigured()) return NextResponse.json({ rooms: [], source: "outlook" });

  try {
    const rooms = await roomsWithAvailability(start, end);
    if (rooms.length) return NextResponse.json({ rooms, source: "outlook" });
  } catch {
    // keep Outlook rooms even if free/busy fails
  }
  try {
    const rooms = await listHqRooms();
    return NextResponse.json({ rooms, source: "outlook" });
  } catch {
    return NextResponse.json({ rooms: [], source: "outlook" });
  }
}
