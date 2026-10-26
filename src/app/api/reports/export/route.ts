import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { searchVisits } from "@/lib/queries";
import { primaryVisitor } from "@/lib/visits";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.redirect(new URL("login", `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/`));
  }
  const visits = await searchVisits(session, { take: 500 });
  const header = [
    "Visit ID",
    "Status",
    "Type",
    "Visitor",
    "Company",
    "Mobile",
    "Host",
    "Department",
    "Purpose",
    "Date",
    "Check-in",
    "Check-out",
    "Duration",
  ];
  const rows = visits.map((visit) => {
    const visitor = primaryVisitor(visit);
    return [
      visit.visitCode,
      visit.status,
      visit.type,
      visitor?.fullName ?? "",
      visitor?.company ?? "",
      visitor?.mobile ?? "",
      visit.host.name,
      visit.department.name,
      visit.purpose.replaceAll(",", " "),
      visit.visitDate.toISOString(),
      visit.checkInAt?.toISOString() ?? "",
      visit.checkOutAt?.toISOString() ?? "",
      visit.durationMinutes ?? "",
    ].join(",");
  });
  const csv = [header.join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=neweast-visits.csv",
    },
  });
}
