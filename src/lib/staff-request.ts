import { addTimeline, writeAudit } from "./audit";
import { startArrangements } from "./arrangements";
import { GUEST_KIND_LABEL, type GuestKind } from "./constants";
import { visitTypeFromKind } from "./email-template";
import { fmtDate, fmtTime } from "./format";
import { makeQrToken, nextVisitCode } from "./ids";
import { notify, notifyRoles } from "./notify";
import { canUseRequestDesk } from "./access";
import type { SessionUser } from "./permissions";
import { prisma } from "./prisma";
import { assertFutureVisit, combineVisitDateTime } from "./visit-schedule";
import { upsertVisitor } from "./visits";

const HIDDEN_HOST = "olga@neweast.co";

export type StaffVisitorInput = {
  fullName: string;
  mobile: string;
  email: string;
  company: string;
  jobTitle: string;
  nationality: string;
};

export type StaffRequestInput = {
  visitDate: string;
  arrivalTime: string;
  departmentId: string;
  guestKind: GuestKind;
  purpose: string;
  driverRequired: boolean;
  giftRequired: boolean;
  giftType: string | null;
  gatePassRequired: boolean;
  visitors: StaffVisitorInput[];
};

export function isDeskSource(source: string) {
  return source === "EMAIL" || source === "STAFF";
}

async function lineManagerFor(actor: SessionUser) {
  const me = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { managerName: true, name: true },
  });
  const name = me?.managerName?.trim();
  if (!name || name.toLowerCase() === me?.name.toLowerCase()) return null;
  const people = await prisma.user.findMany({
    where: { isActive: true, NOT: { email: HIDDEN_HOST } },
    select: { id: true, name: true, email: true },
  });
  return people.find((person) => person.name.toLowerCase() === name.toLowerCase()) || null;
}

export async function requesterLineManager(actor: SessionUser) {
  const manager = await lineManagerFor(actor);
  return manager ? { id: manager.id, name: manager.name } : null;
}

export async function createStaffRequest(actor: SessionUser, input: StaffRequestInput) {
  if (!canUseRequestDesk(actor)) {
    throw new Error("This account cannot submit a visit request.");
  }
  if (actor.email.toLowerCase() === HIDDEN_HOST) throw new Error("This account cannot request a visit.");
  const visitorsIn = input.visitors.map((visitor) => ({ ...visitor, fullName: visitor.fullName.trim() })).filter((visitor) => visitor.fullName);
  if (!visitorsIn.length) throw new Error("Add at least one guest.");
  if (visitorsIn.some((visitor) => !visitor.mobile.trim())) throw new Error("Mobile is required for each guest.");
  if (visitorsIn.some((visitor) => !visitor.email.trim() || !visitor.email.includes("@"))) {
    throw new Error("Email is required for each guest.");
  }
  if (!input.purpose.trim()) throw new Error("Purpose is required.");
  if (!input.departmentId) throw new Error("Choose a department.");
  if (input.giftRequired && !input.giftType?.trim()) throw new Error("Choose a gift type.");
  assertFutureVisit(input.visitDate, input.arrivalTime);

  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw new Error("Choose a department.");
  const manager = await lineManagerFor(actor);
  const visitors = await Promise.all(
    visitorsIn.map((visitor, index) =>
      upsertVisitor({
        fullName: visitor.fullName,
        mobile: visitor.mobile.replace(/\s+/g, "") || `inbox:staff-${actor.id}-${index}-${visitor.fullName}`,
        email: visitor.email,
        company: visitor.company,
        jobTitle: visitor.jobTitle,
        nationality: visitor.nationality,
        visitorType: input.guestKind,
      }),
    ),
  );

  const visit = await prisma.visit.create({
    data: {
      visitCode: await nextVisitCode(),
      type: visitTypeFromKind(input.guestKind),
      status: manager ? "MANAGER_REVIEW" : "INTAKE",
      purpose: input.purpose.trim(),
      visitDate: new Date(`${input.visitDate}T00:00:00`),
      expectedArrival: combineVisitDateTime(input.visitDate, input.arrivalTime),
      hostId: actor.id,
      departmentId: department.id,
      visitorCount: visitors.length,
      vip: input.guestKind === "VIP",
      accessArea: "General Offices",
      qrToken: makeQrToken(),
      createdById: actor.id,
      lineManagerId: manager?.id || null,
      source: "STAFF",
      guestKind: input.guestKind,
      driverRequired: input.driverRequired,
      pickupRequired: input.driverRequired,
      giftRequired: input.giftRequired,
      giftType: input.giftRequired ? input.giftType?.trim() || null : null,
      gatePassRequired: input.gatePassRequired,
      visitors: {
        create: visitors.map((visitor, index) => ({
          visitorId: visitor.id,
          isPrimary: index === 0,
        })),
      },
    },
  });

  await addTimeline({
    visitId: visit.id,
    event: manager ? "Sent to line manager" : "Sent to Administration",
    note: manager ? manager.name : "No line manager on file",
    userId: actor.id,
  });
  await writeAudit({
    userId: actor.id,
    visitId: visit.id,
    action: "Staff visit requested",
    module: "Staff request",
    newValue: { visitCode: visit.visitCode, manager: manager?.name || null },
  });

  const guest = visitorsIn[0]?.fullName || "a guest";
  if (manager) {
    await notify({
      userId: manager.id,
      visitId: visit.id,
      type: "LINE_APPROVAL",
      title: "Visit request to approve",
      message: [
        `${actor.name} asked you to approve a visit.`,
        `${visit.visitCode} · ${guest} · ${GUEST_KIND_LABEL[input.guestKind]}`,
        `${input.visitDate} ${input.arrivalTime} · ${department.name}`,
        `Purpose: ${input.purpose.trim()}`,
        input.driverRequired ? "Driver and car requested." : "",
        input.giftRequired ? `Gift: ${input.giftType}` : "",
        input.gatePassRequired ? "Gate pass requested." : "",
      ]
        .filter(Boolean)
        .join("\n"),
      onBehalfOf: manager.name,
    });
  } else {
    await startArrangements(visit.id);
    await notifyReceptionIntake({
      visitId: visit.id,
      visitCode: visit.visitCode,
      guest,
      requesterName: actor.name,
      purpose: input.purpose.trim(),
    });
  }

  return { visit, managerName: manager?.name || null };
}

export async function decideStaffRequest(
  actor: SessionUser,
  visitId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
) {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true }, take: 1 } },
  });
  if (visit.source !== "STAFF" || visit.status !== "MANAGER_REVIEW") {
    throw new Error("This request is not waiting on a line manager.");
  }
  if (visit.lineManagerId !== actor.id && actor.role !== "SYSTEM_ADMIN") {
    throw new Error("Only the line manager can decide this request.");
  }
  const comment = note?.trim() || "";
  if (decision === "REJECTED") {
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: "REJECTED", intakeNotes: comment || visit.intakeNotes },
    });
    await addTimeline({ visitId, event: "Line manager declined", note: comment || undefined, userId: actor.id });
    await notify({
      userId: visit.createdById,
      visitId,
      type: "VISIT_DECLINED",
      title: "Visit request declined",
      message: [`Your visit request ${visit.visitCode} was declined by your line manager.`, comment].filter(Boolean).join("\n"),
      onBehalfOf: visit.createdBy.name,
    });
    return;
  }
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: "INTAKE", intakeNotes: comment || visit.intakeNotes },
    });
  await addTimeline({ visitId, event: "Line manager approved", note: comment || "Sent to Administration", userId: actor.id });
  await notify({
    userId: visit.createdById,
    visitId,
    type: "VISIT_UPDATE",
    title: "Visit request with Administration",
    message: [
      `${visit.visitCode} was approved by your line manager and is now with Administration.`,
      comment ? `Comment: ${comment}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    onBehalfOf: visit.createdBy.name,
  });
  const guest = visit.visitors[0]?.visitor.fullName || "a guest";
  await notifyReceptionIntake({
    visitId,
    visitCode: visit.visitCode,
    guest,
    requesterName: visit.createdBy.name,
    purpose: visit.purpose,
    approvedBy: actor.name,
  });
  await startArrangements(visitId);
}

async function notifyReceptionIntake(input: {
  visitId: string;
  visitCode: string;
  guest: string;
  requesterName: string;
  purpose: string;
  approvedBy?: string;
}) {
  await notifyRoles(["HR_ADMIN"], {
    visitId: input.visitId,
    type: "INTAKE_READY",
    title: "Visit ready for reception",
    message: [
      `${input.visitCode} needs a meeting room and intake.`,
      input.approvedBy ? `Approved by ${input.approvedBy}.` : "No line manager on file — sent to Administration.",
      `Requester: ${input.requesterName}`,
      `Guest: ${input.guest}`,
      `Purpose: ${input.purpose}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function notifyStaffVisitConfirmed(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit || visit.source !== "STAFF") return;
  const end =
    visit.expectedDeparture && visit.expectedDeparture > visit.expectedArrival
      ? visit.expectedDeparture
      : new Date(visit.expectedArrival.getTime() + 60 * 60 * 1000);
  const names = visit.visitors.map((link) => link.visitor.fullName).filter(Boolean);
  await notify({
    userId: visit.createdById,
    visitId,
    type: "VISIT_CONFIRMED",
    title: "Your visit is confirmed",
    message: [
      `${visit.visitCode} is confirmed.`,
      `When: ${fmtDate(visit.expectedArrival)} · ${fmtTime(visit.expectedArrival)}–${fmtTime(end)}`,
      `Room: ${visit.meetingRoom || "Meeting room"}`,
      `Guests: ${names.join(", ") || visit.visitorCount}`,
    ].join("\n"),
    onBehalfOf: visit.createdBy.name,
  });
}
