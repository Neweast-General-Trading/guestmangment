import { addTimeline, writeAudit } from "./audit";
import {
  GUEST_KIND_LABEL,
  HANNA_EMAILS,
  JESMAN_EMAILS,
  SALMA_EMAILS,
  SAMIR_EMAILS,
  TOUR_TYPE_LABEL,
  isSalmaEmail,
  parseTourType,
  type GuestKind,
  type TourType,
} from "./constants";
import { fmtDate, fmtTime } from "./format";
import { sendNoticeEmail } from "./mail";
import { noticeCta, noticeUrl } from "./notice-copy";
import { notify } from "./notify";
import type { SessionUser } from "./permissions";
import { prisma } from "./prisma";
import { sendTeamsNotice } from "./teams";

export function tourBlocksConfirm(visit: { tourType?: string | null; tourStatus?: string | null }) {
  return parseTourType(visit.tourType) === "BUILDING" && visit.tourStatus !== "APPROVED";
}

export function visitBlocksConfirm(visit: {
  tourType?: string | null;
  tourStatus?: string | null;
  guestKind?: string | null;
  type?: string | null;
  supplierStatus?: string | null;
}) {
  return tourBlocksConfirm(visit);
}

export function tourLabel(value?: string | null) {
  return TOUR_TYPE_LABEL[parseTourType(value)];
}

const visitBriefInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  host: { select: { name: true, email: true } },
  department: { select: { name: true } },
  visitors: { include: { visitor: true }, orderBy: { isPrimary: "desc" as const } },
};

async function findUserByEmails(emails: readonly string[]) {
  const wanted = new Set([...emails].map((item) => item.toLowerCase()));
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, name: true },
  });
  return users.find((user) => wanted.has(user.email.toLowerCase())) || null;
}

export async function notifyNamed(input: {
  emails: readonly string[];
  name: string;
  visitId: string;
  type: string;
  title: string;
  message: string;
}) {
  const user = await findUserByEmails(input.emails);
  if (user) {
    await notify({
      userId: user.id,
      visitId: input.visitId,
      type: input.type,
      title: input.title,
      message: input.message,
      onBehalfOf: user.name,
    });
    return;
  }
  const to = input.emails[0];
  if (!to) return;
  const url = noticeUrl(input.type, input.visitId);
  const cta = noticeCta(input.type);
  await sendNoticeEmail({
    to,
    title: input.title,
    message: input.message,
    onBehalfOf: input.name,
    url,
    cta,
  }).catch(() => undefined);
  await sendTeamsNotice({
    title: input.title,
    message: input.message,
    onBehalfOf: input.name,
    mailId: to,
    name: input.name,
    type: input.type,
  }).catch(() => undefined);
}

function guestLines(visit: {
  visitors: { visitor: { fullName: string; mobile: string; email: string | null; company: string | null; jobTitle: string | null } }[];
  visitorCount: number;
}) {
  const rows = visit.visitors.map((link) => {
    const person = link.visitor;
    return [
      person.fullName,
      person.company,
      person.jobTitle,
      person.mobile && !/^(pending:|inbox:)/i.test(person.mobile) ? person.mobile : "",
      person.email,
    ]
      .filter(Boolean)
      .join(" · ");
  });
  return rows.length ? rows : [`${visit.visitorCount} guests`];
}

export function visitDetailLines(visit: {
  visitCode: string;
  purpose: string;
  guestKind?: string | null;
  type: string;
  tourType?: string | null;
  expectedArrival: Date;
  expectedDeparture?: Date | null;
  meetingRoom?: string | null;
  visitorCount: number;
  driverRequired: boolean;
  giftRequired: boolean;
  giftType?: string | null;
  gatePassRequired: boolean;
  createdBy: { name: string };
  host: { name: string };
  department: { name: string };
  visitors: { visitor: { fullName: string; mobile: string; email: string | null; company: string | null; jobTitle: string | null } }[];
}) {
  const end =
    visit.expectedDeparture && visit.expectedDeparture > visit.expectedArrival
      ? visit.expectedDeparture
      : new Date(visit.expectedArrival.getTime() + 60 * 60 * 1000);
  const kind = (visit.guestKind || visit.type || "GUEST") as GuestKind;
  return [
    `Visit: ${visit.visitCode}`,
    `Guest type: ${GUEST_KIND_LABEL[kind] || kind}`,
    `Tour: ${tourLabel(visit.tourType)}`,
    `When: ${fmtDate(visit.expectedArrival)} · ${fmtTime(visit.expectedArrival)}–${fmtTime(end)}`,
    `Room: ${visit.meetingRoom || "Not set yet"}`,
    `Department: ${visit.department.name}`,
    `Host: ${visit.host.name}`,
    `Requester: ${visit.createdBy.name}`,
    `Purpose: ${visit.purpose}`,
    visit.driverRequired ? "Driver and car: Yes" : "",
    visit.giftRequired ? `Gift: ${visit.giftType || "Yes"}` : "",
    visit.gatePassRequired ? "Gate pass: Yes" : "",
    "Guests:",
    ...guestLines(visit).map((line) => `  ${line}`),
  ].filter(Boolean);
}

export function buildingTourAutoApproved(requesterEmail?: string | null) {
  return isSalmaEmail(requesterEmail);
}

export async function applyTourType(visitId: string, tourType: TourType) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: { select: { email: true } } },
  });
  if (!visit) return;
  if (tourType === "GF") {
    const already = visit.tourType === "GF";
    await prisma.visit.update({
      where: { id: visitId },
      data: { tourType: "GF", tourStatus: null },
    });
    if (!already) await notifyTourWatchers(visitId, "GF");
    await syncSupplierApproval(visitId);
    return;
  }
  if (tourType === "BUILDING") {
    if (buildingTourAutoApproved(visit.createdBy.email)) {
      const already = visit.tourType === "BUILDING" && visit.tourStatus === "APPROVED";
      await prisma.visit.update({
        where: { id: visitId },
        data: { tourType: "BUILDING", tourStatus: "APPROVED" },
      });
      if (!already) {
        await addTimeline({
          visitId,
          event: "Building tour approved",
          note: "Approved with the request — Salma Moufallah is the requester",
        });
        await notifyTourWatchers(visitId, "BUILDING");
      }
      await syncSupplierApproval(visitId);
      return;
    }
    const pending = visit.tourStatus === "PENDING";
    const approved = visit.tourStatus === "APPROVED";
    await prisma.visit.update({
      where: { id: visitId },
      data: {
        tourType: "BUILDING",
        tourStatus: approved ? "APPROVED" : "PENDING",
      },
    });
    if (!approved && !pending) {
      await notifyBuildingTour(visitId);
      await notifyTourWatchers(visitId, "BUILDING");
    }
    await syncSupplierApproval(visitId);
    return;
  }
  await prisma.visit.update({
    where: { id: visitId },
    data: { tourType: "NONE", tourStatus: null },
  });
  await syncSupplierApproval(visitId);
}

async function notifyTourWatchers(visitId: string, tour: "GF" | "BUILDING") {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: visitBriefInclude,
  });
  if (!visit) return;
  const label = tour === "GF" ? "ground-floor tour" : "building tour";
  const message = [`A ${label} was requested.`, ...visitDetailLines(visit)].join("\n");
  const targets =
    tour === "GF"
      ? [
          { emails: HANNA_EMAILS, name: "Hannah Talastas" },
          { emails: SALMA_EMAILS, name: "Salma Moufallah" },
        ]
      : [{ emails: HANNA_EMAILS, name: "Hannah Talastas" }];
  for (const target of targets) {
    await notifyNamed({
      emails: target.emails,
      name: target.name,
      visitId,
      type: "TOUR_NOTICE",
      title: tour === "GF" ? "Ground-floor tour" : "Building tour requested",
      message,
    });
  }
  await addTimeline({
    visitId,
    event: "Tour notice sent",
    note: tour === "GF" ? "Hannah Talastas and Salma Moufallah" : "Hannah Talastas",
  });
}

async function notifyBuildingTour(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: visitBriefInclude,
  });
  if (!visit) return;
  const kind = (visit.guestKind || visit.type || "GUEST") as GuestKind;
  const who = kind === "CUSTOMER" ? "A customer" : "A visitor";
  await notifyNamed({
    emails: SALMA_EMAILS,
    name: "Salma Moufallah",
    visitId,
    type: "BUILDING_TOUR",
    title: "Building tour approval",
    message: [
      `${who} requested a building visit.`,
      ...visitDetailLines(visit),
      "Approve to confirm the booking.",
    ].join("\n"),
  });
  await addTimeline({ visitId, event: "Building tour sent to Salma Moufallah" });
}

export async function decideBuildingTour(
  actor: SessionUser,
  visitId: string,
  decision: "APPROVED" | "REJECTED",
  notes?: string,
) {
  if (!isSalmaEmail(actor.email) && actor.role !== "SYSTEM_ADMIN") {
    throw new Error("Only Salma can decide a building tour.");
  }
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
  if (parseTourType(visit.tourType) !== "BUILDING" || visit.tourStatus !== "PENDING") {
    throw new Error("This visit is not waiting on a building tour.");
  }
  const note = notes?.trim() || "";
  const kind = (visit.guestKind || visit.type || "").toUpperCase();
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      tourStatus: decision,
      ...(decision === "APPROVED" && kind === "SUPPLIER" && visit.supplierStatus === "PENDING"
        ? { supplierStatus: "APPROVED" }
        : {}),
    },
  });
  await addTimeline({
    visitId,
    event: decision === "APPROVED" ? "Building tour approved" : "Building tour rejected",
    note: note || undefined,
    userId: actor.id,
  });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: decision === "APPROVED" ? "Building tour approved" : "Building tour rejected",
    module: "Building tours",
    previousValue: "PENDING",
    newValue: decision,
  });
}

export async function syncSupplierApproval(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: visitBriefInclude,
  });
  if (!visit) return;
  const kind = (visit.guestKind || visit.type || "").toUpperCase();
  if (kind !== "SUPPLIER") {
    if (visit.supplierStatus) {
      await prisma.visit.update({ where: { id: visitId }, data: { supplierStatus: null } });
    }
    return;
  }
  if (visit.supplierStatus) return;
  const message = ["A supplier visit was requested. This is a notice only.", ...visitDetailLines(visit)].join("\n");
  await notifyNamed({
    emails: HANNA_EMAILS,
    name: "Hannah Talastas",
    visitId,
    type: "TOUR_NOTICE",
    title: "Supplier visit",
    message,
  });
  await notifyNamed({
    emails: SALMA_EMAILS,
    name: "Salma Moufallah",
    visitId,
    type: "TOUR_NOTICE",
    title: "Supplier visit",
    message,
  });
  await prisma.visit.update({ where: { id: visitId }, data: { supplierStatus: "NOTIFIED" } });
  await addTimeline({ visitId, event: "Supplier visit notice sent", note: "Hannah Talastas and Salma Moufallah" });
}

export async function decideSupplierVisit(
  actor: SessionUser,
  visitId: string,
  decision: "APPROVED" | "REJECTED",
  notes?: string,
) {
  if (!isSalmaEmail(actor.email) && actor.role !== "SYSTEM_ADMIN") {
    throw new Error("Only Salma can approve a supplier visit.");
  }
  const visit = await prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
  const kind = (visit.guestKind || visit.type || "").toUpperCase();
  if (kind !== "SUPPLIER" || visit.supplierStatus !== "PENDING") {
    throw new Error("This visit is not waiting on supplier approval.");
  }
  const note = notes?.trim() || "";
  await prisma.visit.update({ where: { id: visitId }, data: { supplierStatus: decision } });
  await addTimeline({
    visitId,
    event: decision === "APPROVED" ? "Supplier visit approved" : "Supplier visit rejected",
    note: note || undefined,
    userId: actor.id,
  });
  await writeAudit({
    userId: actor.id,
    visitId,
    action: decision === "APPROVED" ? "Supplier visit approved" : "Supplier visit rejected",
    module: "Building tours",
    previousValue: "PENDING",
    newValue: decision,
  });
}

export async function briefVisitStakeholders(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: visitBriefInclude,
  });
  if (!visit || visit.briefingSentAt) return { sent: false as const };
  if (visitBlocksConfirm(visit)) return { sent: false as const };
  const kind = (visit.guestKind || visit.type || "").toUpperCase();
  const tour = parseTourType(visit.tourType);
  const targets: { emails: readonly string[]; name: string }[] = [];
  if (kind === "CUSTOMER") targets.push({ emails: SAMIR_EMAILS, name: "Samir Ibrahim" });
  if (kind === "SUPPLIER") {
    targets.push({ emails: HANNA_EMAILS, name: "Hannah Talastas" });
    targets.push({ emails: SALMA_EMAILS, name: "Salma Moufallah" });
  }
  if (tour === "GF" || tour === "BUILDING") {
    targets.push({ emails: HANNA_EMAILS, name: "Hannah Talastas" });
    targets.push({ emails: SALMA_EMAILS, name: "Salma Moufallah" });
    targets.push({ emails: JESMAN_EMAILS, name: "Jesman Muruganantham" });
  }
  const seen = new Set<string>();
  const unique = targets.filter((target) => {
    const key = target.emails[0]?.toLowerCase() || target.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length) return { sent: false as const };
  const message = ["The meeting room is confirmed.", ...visitDetailLines(visit)].join("\n");
  for (const target of unique) {
    await notifyNamed({
      emails: target.emails,
      name: target.name,
      visitId,
      type: "VISIT_BRIEFING",
      title: `Confirmed visit · ${visit.visitCode}`,
      message,
    });
  }
  await prisma.visit.update({ where: { id: visitId }, data: { briefingSentAt: new Date() } });
  return { sent: true as const };
}
