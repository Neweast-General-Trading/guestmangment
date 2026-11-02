import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { isGuestDocType, parseGuestDocs } from "@/lib/guest-doc-types";
import { readGuestDoc } from "@/lib/guest-docs";
import { canSeePasses, isGatePassApprover } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ visitId: string; type: string }> }) {
  const session = await requireSession();
  if (!session) return new NextResponse("Sign in required.", { status: 401 });
  const { visitId, type } = await context.params;
  if (!isGuestDocType(type)) return new NextResponse("Document not found.", { status: 404 });
  const url = new URL(_request.url);
  const linkId = url.searchParams.get("link");
  const storedName = url.searchParams.get("file");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      attachmentsJson: true,
      createdById: true,
      visitors: { where: { id: linkId || "" }, select: { attachmentsJson: true } },
    },
  });
  const docs = parseGuestDocs(linkId ? visit?.visitors[0]?.attachmentsJson : visit?.attachmentsJson);
  const doc = storedName
    ? docs.find((item) => item.type === type && item.stored === storedName)
    : docs.find((item) => item.type === type);
  if (!visit || !doc) return new NextResponse("Document not found.", { status: 404 });
  const allowed = isGatePassApprover(session) || canSeePasses(session) || visit.createdById === session.id;
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
