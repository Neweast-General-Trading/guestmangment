import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "./prisma";
import { addTimeline } from "./audit";
import { notify, notifyRoles } from "./notify";
import { fmtDateTime } from "./format";
import { visitEnd } from "./visit-order";

/** Statuses that mean "planned, guest not inside yet". Once the visit's time is over they become PASSED. */
const PASSES_WHEN_OVER = [
  "INTAKE",
  "MANAGER_REVIEW",
  "ESCALATED",
  "PENDING_APPROVAL",
  "APPROVED",
  "INVITATION_SENT",
  "EXPECTED",
  "ARRIVED",
  "WAITING_AT_GATE",
  "SECURITY_VERIFICATION",
];

export async function getSetting(key: string, fallback: string) {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function applyLifecycle(now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const expected = await prisma.visit.findMany({
    where: {
      status: { in: ["APPROVED", "INVITATION_SENT"] },
      visitDate: { gte: todayStart, lte: todayEnd },
    },
  });
  for (const visit of expected) {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { status: "EXPECTED" },
    });
    await addTimeline({ visitId: visit.id, event: "Expected", note: "Visit is expected today." });
  }

  const overdue = await prisma.visit.findMany({
    where: {
      status: { in: ["CHECKED_IN", "CURRENTLY_INSIDE", "IN_MEETING"] },
      expectedDeparture: { lt: now },
    },
  });
  for (const visit of overdue) {
    await prisma.visit.update({ where: { id: visit.id }, data: { status: "OVERDUE" } });
    await addTimeline({ visitId: visit.id, event: "Overdue", note: "Visitor remained past expected departure." });
    await notify({
      userId: visit.hostId,
      visitId: visit.id,
      type: "VISITOR_OVERDUE",
      title: "Visitor overdue",
      message: `${visit.visitCode} is still inside after the expected departure time.`,
    });
    await notifyRoles(["HR_ADMIN", "SECURITY_GUARD", "SECURITY_SUPERVISOR"], {
      visitId: visit.id,
      type: "VISITOR_OVERDUE",
      title: "Visitor overdue",
      message: `${visit.visitCode} is overdue inside Headquarters.`,
    });
  }

  // A visit whose time is over, and whose guest was never checked in, is Passed and moves to history.
  // (Checked-in guests still go through check-out / Overdue at the gate.) No notifications are sent.
  const candidates = await prisma.visit.findMany({
    where: {
      status: { in: PASSES_WHEN_OVER },
      expectedArrival: { lt: now },
      checkInAt: null,
    },
    select: { id: true, status: true, expectedArrival: true, expectedDeparture: true },
  });
  const stale = candidates.filter((visit) => visitEnd(visit).getTime() < now.getTime());
  for (const visit of stale) {
    const moved = await prisma.visit.updateMany({
      where: { id: visit.id, status: visit.status, checkInAt: null },
      data: { status: "PASSED" },
    });
    if (!moved.count) continue;
    await addTimeline({
      visitId: visit.id,
      event: "Passed",
      note: `Visit time ended ${fmtDateTime(visitEnd(visit))}. Moved to history.`,
    });
  }

  return { expected: expected.length, overdue: overdue.length, stale: stale.length };
}
