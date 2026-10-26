import { NextResponse } from "next/server";
import { canSeeTracking } from "@/lib/access";
import { requireSession } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { parseStoredInvitees } from "@/lib/room-booking";
import { loadTracking, trackingSourceLabel, trackingTab } from "@/lib/tracking";

function csv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "").replaceAll('"', '""');
          return /[",\n]/.test(value) ? `"${value}"` : value;
        })
        .join(","),
    )
    .join("\n");
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session || !canSeeTracking(session.email)) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "https://guest.neweast.cloud"));
  }
  const url = new URL(request.url);
  const tab = trackingTab(url.searchParams.get("tab"));
  const data = await loadTracking({
    tab,
    q: url.searchParams.get("q") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    status: url.searchParams.get("status") || undefined,
    origin: url.searchParams.get("origin") || undefined,
    room: url.searchParams.get("room") || undefined,
    booker: url.searchParams.get("booker") || undefined,
    kind: url.searchParams.get("kind") || undefined,
  });

  let rows: string[][] = [];
  if (tab === "rooms") {
    rows = [
      ["Room", "Start", "End", "Booked by", "Email", "Details", "Invitees", "Source", "Status"],
      ...data.rooms.map((row) => [
        row.roomName,
        fmtDateTime(row.startAt),
        fmtDateTime(row.endAt),
        row.bookedByName,
        row.bookedByEmail,
        [row.subject, row.description].filter(Boolean).join(" — "),
        parseStoredInvitees(row.invitees)
          .map((item) => item.name || item.email)
          .join("; "),
        row.origin === "outlook" ? "Outlook" : "Guest app",
        row.cancelledAt ? "Cancelled" : row.roomReply || "Held",
      ]),
    ];
  } else if (tab === "parking") {
    rows = [
      ["Bay", "Employee", "Email", "Plate", "Assigned by", "When"],
      ...data.parking.map((row) => [row.slot, row.user.name, row.user.email, row.plate, row.assignedBy.name, fmtDateTime(row.createdAt)]),
    ];
  } else if (tab === "services") {
    rows = [
      ["Visit", "Service", "Status", "Host", "Guest"],
      ...data.services.map((row) => [
        row.visit.visitCode,
        row.service.label,
        row.status,
        row.visit.host.name,
        row.visit.visitors[0]?.visitor.fullName || "",
      ]),
    ];
  } else if (tab === "inbox") {
    rows = [
      ["When", "From", "Email", "Subject", "Kind"],
      ...data.inbox.map((row) => [row.receivedAt, row.fromName, row.from, row.subject, row.kind]),
    ];
  } else if (tab === "activity") {
    rows = [
      ["When", "Who", "Action", "Module", "Visit"],
      ...data.activity.map((row) => [
        fmtDateTime(row.createdAt),
        row.user?.name || "System",
        row.action,
        row.module,
        row.visit?.visitCode || "",
      ]),
    ];
  } else {
    rows = [
      [
        "Visit",
        "Status",
        "Type",
        "Source",
        "Guests",
        "Company",
        "Host",
        "Requester",
        "Department",
        "Purpose",
        "When",
        "Room",
        "Gift",
        "Driver",
        "Gate pass",
        "Check-in",
        "Check-out",
      ],
      ...data.visits.map((visit) => [
        visit.visitCode,
        visit.status,
        visit.type,
        trackingSourceLabel(visit.source),
        visit.visitors.map((link) => link.visitor.fullName).join("; "),
        visit.visitors[0]?.visitor.company || "",
        visit.host.name,
        visit.createdBy.name,
        visit.department.name,
        visit.purpose,
        fmtDateTime(visit.expectedArrival),
        visit.meetingRoom || visit.location || "",
        visit.giftRequired ? visit.giftType || "Yes" : "No",
        visit.driverRequired ? visit.driverStatus || "Yes" : "No",
        visit.gatePassRequired ? visit.gatePassStatus || "Yes" : "No",
        fmtDateTime(visit.checkInAt),
        fmtDateTime(visit.checkOutAt),
      ]),
    ];
  }

  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=neweast-tracking-${tab}.csv`,
    },
  });
}
