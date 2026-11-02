import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { isGuestDocType } from "@/lib/guest-doc-types";
import { docOfType, readGuestDoc } from "@/lib/guest-docs";
import { canManageIntake, canSeeAllVisits } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ visitId: string; type: string }> }) {
  const session = await requireSession();
  if (!session) return new NextResponse("Sign in required.", { status: 401 });
  const { visitId, type } = await context.params;
  if (!isGuestDocType(type)) return new NextResponse("Document not found.", { status: 404 });
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { attachmentsJson: true, createdById: true, hostId: true, lineManagerId: true },
  });
  const doc = docOfType(visit?.attachmentsJson, type);
  if (!visit || !doc) return new NextResponse("Document not found.", { status: 404 });
  const allowed =
    visit.createdById === session.id ||
    visit.hostId === session.id ||
    visit.lineManagerId === session.id ||
    canManageIntake(session.role) ||
    canSeeAllVisits(session.role);
  if (!allowed) return new NextResponse("You cannot open this document.", { status: 403 });
  const file = await readGuestDoc(doc.stored, type);
  if (!file) return new NextResponse("Document file is missing.", { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `inline; filename="${doc.name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
