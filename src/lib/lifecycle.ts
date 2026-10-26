import { addMinutes, endOfDay, startOfDay } from "date-fns";
import { prisma } from "./prisma";
import { addTimeline } from "./audit";
import { notify, notifyRoles } from "./notify";

export async function getSetting(key: string, fallback: string) {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function applyLifecycle(now = new Date()) {
  const windowMinutes = Number(await getSetting("appointment_window_minutes", "120"));
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

  const stale = await prisma.visit.findMany({
    where: {
      status: { in: ["APPROVED", "INVITATION_SENT", "EXPECTED"] },
      expectedArrival: { lt: addMinutes(now, -windowMinutes) },
      checkInAt: null,
    },
  });
  for (const visit of stale) {
    const lateSameDay = visit.visitDate >= todayStart && visit.visitDate <= todayEnd;
    const status = lateSameDay ? "NO_SHOW" : "EXPIRED";
    await prisma.visit.update({ where: { id: visit.id }, data: { status } });
    await addTimeline({
      visitId: visit.id,
      event: status === "NO_SHOW" ? "No show" : "Expired",
      note: `Appointment window of ${windowMinutes} minutes elapsed.`,
    });
  }

  return { expected: expected.length, overdue: overdue.length, stale: stale.length };
}
