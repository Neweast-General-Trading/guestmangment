import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readInboxText } from "@/lib/graph";
import { canManageIntake } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageIntake(session.role)) return NextResponse.json({ error: "You cannot open this mail." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id || id.length > 500) return NextResponse.json({ error: "Mail not found." }, { status: 400 });
  try {
    const mail = await readInboxText(id);
    const code = (mail.subject.match(/\bGV-\d{4}-\d+\b/i) || mail.text.match(/\bGV-\d{4}-\d+\b/i))?.[0]?.toUpperCase() || "";
    let visitHref = "";
    if (code) {
      const visit = await prisma.visit.findFirst({
        where: { visitCode: code },
        select: { id: true, status: true, source: true },
      });
      if (visit) {
        const onIntake = (visit.source === "EMAIL" || visit.source === "STAFF") && ["INTAKE", "ESCALATED"].includes(visit.status);
        visitHref = onIntake ? `/intake/${visit.id}` : `/visits/${visit.id}`;
      }
    }
    return NextResponse.json({
      subject: mail.subject,
      text: mail.text.slice(0, 12000),
      visitHref,
      visitCode: code,
    });
  } catch {
    return NextResponse.json({ error: "Could not open this mail." }, { status: 500 });
  }
}
