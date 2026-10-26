import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { syncGuestInbox } from "@/lib/inbox-sync";
import { canManageIntake } from "@/lib/permissions";

export async function POST() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, reason: "Sign in required." }, { status: 401 });
  if (!canManageIntake(session.role)) return NextResponse.json({ ok: false, reason: "Not allowed." }, { status: 403 });
  const result = await syncGuestInbox(session);
  return NextResponse.json(result);
}
