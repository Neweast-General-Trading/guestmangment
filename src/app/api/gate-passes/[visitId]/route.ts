import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readGatePassFile } from "@/lib/gate-pass-file";
import { canManageIntake, canSeePasses } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ visitId: string }> }) {
  const session = await requireSession();
  if (!session) return new NextResponse("Sign in required.", { status: 401 });
  const { visitId } = await context.params;
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { gatePassFile: true, createdById: true },
  });
  if (!visit?.gatePassFile) return new NextResponse("Gate pass not found.", { status: 404 });
  const allowed = visit.createdById === session.id || canSeePasses(session) || canManageIntake(session.role);
  if (!allowed) return new NextResponse("You cannot open this gate pass.", { status: 403 });
  const file = await readGatePassFile(visit.gatePassFile);
  if (!file) return new NextResponse("Gate pass file is missing.", { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `inline; filename="${file.name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
