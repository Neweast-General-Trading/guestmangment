import { createHash } from "crypto";
import { prisma } from "./prisma";
import { addTimeline, writeAudit } from "./audit";
import { notify, notifyRoles } from "./notify";
import { findUserByEmail } from "./payroll";
import { assertFutureVisit, combineVisitDateTime, timeStamp, todayStamp } from "./visit-schedule";
import { makeQrToken, nextVisitCode } from "./ids";
import { upsertVisitor, visitInclude } from "./visits";
import { visitTypeFromKind } from "./email-template";
import { extractGuestRequest } from "./extract-visit";
import type { ParsedGuestRequest } from "./email-template";
import { GUEST_KIND_LABEL, type GuestKind } from "./constants";
import { canManageIntake, canDecideEscalation, type SessionUser } from "./permissions";
import { syncOutlookRoom } from "./room-booking";
import { isDeskSource, notifyStaffVisitConfirmed } from "./staff-request";

const HIDDEN_HOST = "olga@neweast.co";
const ADMIN_EMAIL = "adminsatror@neweast.co";
const SAMIR_EMAIL = "samir.ibrahim@neweast.co";

export function messageDigest(text: string) {
  return createHash("sha1").update(text.trim()).digest("hex").slice(0, 28);
}

function hiddenHost(email?: string | null) {
  return (email || "").toLowerCase() === HIDDEN_HOST;
}

async function fallbackActor() {
  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL, isActive: true },
  });
  if (admin) return admin;
  return prisma.user.findFirstOrThrow({ where: { role: "SYSTEM_ADMIN", isActive: true } });
}

async function matchDepartment(name: string) {
  const depts = await prisma.department.findMany();
  const needle = name.trim().toLowerCase();
  if (!needle) return depts[0] ?? null;
  return (
    depts.find((item) => item.name.toLowerCase() === needle) ||
    depts.find((item) => item.name.toLowerCase().includes(needle) || needle.includes(item.name.toLowerCase())) ||
    depts[0] ||
    null
  );
}

async function resolveHost(departmentId: string) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (dept?.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: dept.managerId, isActive: true },
    });
    if (manager && !hiddenHost(manager.email)) return manager.id;
  }
  const manager = await prisma.user.findFirst({
    where: {
      departmentId,
      role: "DEPARTMENT_MANAGER",
      isActive: true,
      NOT: { email: HIDDEN_HOST },
    },
  });
  if (manager) return manager.id;
  const admin = await fallbackActor();
  return admin.id;
}

function visitorMobile(visitor: ParsedGuestRequest["visitors"][number], index: number) {
  const mobile = visitor.mobile.replace(/\s+/g, "");
  if (mobile) return mobile;
  if (visitor.email) return `inbox:${visitor.email.toLowerCase()}`;
  return `inbox:${messageDigest(`${visitor.fullName}-${index}`)}`;
}

export async function createIntakeFromParsed(
  actor: SessionUser,
  parsed: ParsedGuestRequest,
  meta: { messageId: string; subject?: string; from?: string; raw?: string },
) {
  const existing = await prisma.visit.findUnique({
    where: { emailMessageId: meta.messageId },
    select: { id: true, visitCode: true },
  });
  if (existing) return { visit: existing, created: false };

  const department = await matchDepartment(parsed.department);
  if (!department) throw new Error("No department is available to attach this request.");
  const hostId = await resolveHost(department.id);
  const visitDate = parsed.visitDate || todayStamp();
  const arrival = parsed.arrivalTime || "09:30";
  const kind = parsed.guestKind;
  const visitorsIn = parsed.visitors.length
    ? parsed.visitors
    : [{ fullName: meta.from || "Email guest", mobile: "", email: "", company: "", jobTitle: "", nationality: "" }];
  const visitors = await Promise.all(
    visitorsIn.map((visitor, index) =>
      upsertVisitor({
        fullName: visitor.fullName || `Guest ${index + 1}`,
        mobile: visitorMobile(visitor, index),
        email: visitor.email,
        company: visitor.company,
        jobTitle: visitor.jobTitle,
        nationality: visitor.nationality,
        visitorType: kind,
      }),
    ),
  );

  const purpose = parsed.purpose.trim() || `Email visit request${meta.subject ? ` — ${meta.subject}` : ""}`;
  const visit = await prisma.visit.create({
    data: {
      visitCode: await nextVisitCode(),
      type: visitTypeFromKind(kind),
      status: "INTAKE",
      purpose,
      visitDate: new Date(`${visitDate}T00:00:00`),
      expectedArrival: combineVisitDateTime(visitDate, arrival),
      hostId,
      departmentId: department.id,
      visitorCount: visitors.length,
      vip: kind === "VIP",
      accessArea: "General Offices",
      qrToken: makeQrToken(),
      createdById: actor.id,
      source: "EMAIL",
      emailMessageId: meta.messageId,
      emailSubject: meta.subject || null,
      emailFrom: meta.from || null,
      guestKind: kind,
      driverRequired: parsed.driverRequired,
      intakeNotes: meta.raw ? meta.raw.slice(0, 4000) : null,
      pickupRequired: parsed.driverRequired,
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
    event: "Email request received",
    note: meta.subject || meta.from || "guest inbox",
    userId: actor.id,
  });
  await writeAudit({
    userId: actor.id,
    visitId: visit.id,
    action: "Email intake created",
    module: "Email Intake",
    newValue: { visitCode: visit.visitCode, from: meta.from },
  });
  return { visit, created: true };
}

export async function ingestEmailText(
  actor: SessionUser,
  input: {
    text: string;
    subject?: string;
    from?: string;
    messageId?: string;
    files?: { name: string; bytes: Buffer }[];
  },
) {
  const parsed = await extractGuestRequest(input.text, input.files);
  if (!parsed) {
    throw new Error("The email needs the Excel template attached, or the guest-request text block.");
  }
  if (!parsed.purpose.trim()) {
    parsed.purpose = input.subject?.trim() || "Email visit request";
  }
  const messageId = input.messageId || `local-${messageDigest(input.text || input.files?.[0]?.name || "email")}`;
  return createIntakeFromParsed(actor, parsed, {
    messageId,
    subject: input.subject,
    from: input.from,
    raw: input.text,
  });
}

export async function updateIntakeVisit(
  actor: SessionUser,
  visitId: string,
  input: {
    visitDate: string;
    expectedArrival: string;
    departmentId: string;
    hostId?: string;
    guestKind: GuestKind;
    purpose: string;
    meetingRoom?: string;
    driverRequired: boolean;
    driverName?: string;
    driverMobile?: string;
    driverVehicle?: string;
    visitors: {
      fullName: string;
      mobile: string;
      email?: string;
      company?: string;
      jobTitle?: string;
      nationality?: string;
    }[];
  },
) {
  if (!canManageIntake(actor.role)) throw new Error("Only Administration can edit email intake.");
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
  if (!isDeskSource(visit.source) || !["INTAKE", "ESCALATED"].includes(visit.status)) {
    throw new Error("This request is no longer on the intake desk.");
  }
  if (!input.visitors.length) throw new Error("At least one visitor is required.");
  if (!input.purpose.trim()) throw new Error("Purpose is required.");

  const visitors = await Promise.all(
    input.visitors.map((visitor) =>
      upsertVisitor({
        fullName: visitor.fullName,
        mobile: visitor.mobile,
        email: visitor.email,
        company: visitor.company,
        jobTitle: visitor.jobTitle,
        nationality: visitor.nationality,
        visitorType: input.guestKind,
      }),
    ),
  );
  await prisma.visitVisitor.deleteMany({ where: { visitId } });
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      purpose: input.purpose.trim(),
      visitDate: new Date(`${input.visitDate}T00:00:00`),
      expectedArrival: combineVisitDateTime(input.visitDate, input.expectedArrival),
      departmentId: input.departmentId,
      hostId: input.hostId || visit.hostId,
      type: visitTypeFromKind(input.guestKind),
      guestKind: input.guestKind,
      vip: input.guestKind === "VIP",
      meetingRoom: input.meetingRoom?.trim() || null,
      driverRequired: input.driverRequired,
      driverName: input.driverName?.trim() || null,
      driverMobile: input.driverMobile?.trim() || null,
      driverVehicle: input.driverVehicle?.trim() || null,
      pickupRequired: input.driverRequired,
      visitorCount: visitors.length,
      visitors: {
        create: visitors.map((visitor, index) => ({
          visitorId: visitor.id,
          isPrimary: index === 0,
        })),
      },
    },
  });
  await addTimeline({ visitId, event: "Intake updated", userId: actor.id });
  if (input.meetingRoom?.trim()) {
    await syncOutlookRoom(visitId, input.meetingRoom);
  }
}

export async function confirmIntake(
  actor: SessionUser,
  visitId: string,
  input: {
    meetingRoom: string;
    driverName?: string;
    driverMobile?: string;
    driverVehicle?: string;
  },
) {
  if (!canManageIntake(actor.role)) throw new Error("Only Administration can confirm intake.");
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
  if (visit.status !== "INTAKE") throw new Error("Confirm is only available on new email requests.");
  if (!input.meetingRoom.trim()) throw new Error("Choose a meeting room before confirming.");
  if (visit.driverRequired && visit.driverStatus !== "DONE" && !input.driverName?.trim()) {
    throw new Error("Contact the driver and mark Done, or enter the driver name.");
  }
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      meetingRoom: input.meetingRoom.trim(),
      driverName: input.driverName?.trim() || null,
      driverMobile: input.driverMobile?.trim() || null,
      driverVehicle: input.driverVehicle?.trim() || null,
    },
  });
  const booked = await syncOutlookRoom(visitId, input.meetingRoom);
  await addTimeline({
    visitId,
    event: "Intake confirmed",
    note: booked.booked
      ? `${input.meetingRoom.trim()} · Outlook confirmation to guest@neweast.co`
      : input.meetingRoom.trim(),
    userId: actor.id,
  });
  await notifyStaffVisitConfirmed(visitId).catch(() => undefined);
}

export async function escalateIntake(actor: SessionUser, visitId: string, notes?: string) {
  if (!canManageIntake(actor.role)) throw new Error("Only Administration can escalate.");
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: visitInclude,
  });
  if (visit.status !== "INTAKE") throw new Error("Only a new intake request can be escalated.");
  if (visit.guestKind !== "CUSTOMER" && visit.type !== "CUSTOMER") {
    throw new Error("Escalation is only for Customer requests.");
  }
  const samir = await findUserByEmail(SAMIR_EMAIL);
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: "ESCALATED",
      escalationNotes: notes?.trim() || visit.escalationNotes,
    },
  });
  await addTimeline({
    visitId,
    event: "Escalated to Samir Ibrahim",
    note: notes?.trim() || undefined,
    userId: actor.id,
  });
  if (samir) {
    const guest = visit.visitors[0]?.visitor;
    await notify({
      userId: samir.id,
      visitId,
      type: "ESCALATION_REQUIRED",
      title: "Customer visit escalation",
      message: [
        `${visit.visitCode} needs your decision.`,
        `Guest: ${guest?.fullName || "Visitor"} · ${GUEST_KIND_LABEL[(visit.guestKind as GuestKind) || "CUSTOMER"]}`,
        `Department: ${visit.department.name}`,
        `When: ${visit.expectedArrival.toISOString().slice(0, 16).replace("T", " ")}`,
        `People: ${visit.visitorCount}`,
        `Driver: ${visit.driverRequired ? "Yes" : "No"}`,
        `Purpose: ${visit.purpose}`,
        notes?.trim() ? `Administration note: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }
}

export async function decideEscalation(
  actor: SessionUser,
  visitId: string,
  decision: "APPROVED" | "REJECTED",
  notes?: string,
) {
  if (!canDecideEscalation(actor)) throw new Error("Only Samir can decide this escalation.");
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
  if (visit.status !== "ESCALATED") throw new Error("This request is not waiting on escalation.");
  const note = notes?.trim() || "";
  if (decision === "REJECTED") {
    await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: "REJECTED",
        escalationNotes: [visit.escalationNotes, note && `Samir: ${note}`].filter(Boolean).join("\n"),
      },
    });
    await addTimeline({ visitId, event: "Escalation rejected", note: note || undefined, userId: actor.id });
    return;
  }
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      status: "INTAKE",
      escalationNotes: [visit.escalationNotes, note && `Samir approved: ${note}`].filter(Boolean).join("\n"),
    },
  });
  await addTimeline({ visitId, event: "Escalation approved", note: note || undefined, userId: actor.id });
}

export async function submitIntake(actor: SessionUser, visitId: string) {
  if (!canManageIntake(actor.role)) throw new Error("Only Administration can submit to Security.");
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { visitors: true },
  });
  if (!isDeskSource(visit.source)) throw new Error("This is not an intake request.");
  if (visit.status !== "INTAKE") throw new Error("Submit is only available after preparation.");
  if (!visit.meetingRoom) throw new Error("Confirm a meeting room before submitting.");
  if (visit.driverRequired && visit.driverStatus !== "DONE" && !visit.driverName) {
    throw new Error("Contact the driver and mark Done, or add driver details.");
  }
  if (visit.gatePassRequired && visit.gatePassStatus !== "DONE") {
    throw new Error("Wait for HR to prepare the gate pass, then mark it Done.");
  }
  if (!visit.visitors.length) throw new Error("Add at least one visitor before submitting.");
  assertFutureVisit(todayStamp(visit.expectedArrival), timeStamp(visit.expectedArrival));
  await prisma.visit.update({
    where: { id: visitId },
    data: { status: "EXPECTED" },
  });
  await addTimeline({ visitId, event: "Submitted to Security", userId: actor.id });
  await notifyRoles(["SECURITY_GUARD", "SECURITY_SUPERVISOR"], {
    visitId,
    type: "SECURITY_DESK",
    title: "Visit ready at the desk",
    message: `${visit.visitCode} is expected and ready for check-in.`,
  });
}
