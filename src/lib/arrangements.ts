import { addTimeline, writeAudit } from "./audit";
import { GATE_PASS_OWNER_EMAIL, GIFT_OWNER_EMAIL } from "./arrangement-types";
import { prisma } from "./prisma";
import { fmtDate, fmtTime } from "./format";
import { notify, notifyRoles } from "./notify";
import { canApproveGatePass, canApproveGift, canManageIntake, canSeeGifts, canSeePasses, type SessionUser } from "./permissions";

type VisitParty = {
  id: string;
  visitCode: string;
  visitDate: Date;
  expectedArrival: Date;
  purpose: string;
  giftType: string | null;
  createdById: string;
  createdBy: { id: string; name: string };
  visitors: { visitor: { fullName: string } }[];
};

export function giftFromForm(formData: FormData) {
  const required = String(formData.get("giftRequired") || "") === "yes";
  if (!required) return { giftRequired: false, giftType: null as string | null };
  const kind = String(formData.get("giftType") || "").trim();
  const other = String(formData.get("giftTypeOther") || "").trim();
  const giftType = kind === "Other" ? other || "Other" : kind;
  if (!giftType) throw new Error("Choose a gift type.");
  return { giftRequired: true, giftType };
}

export async function giftApprover() {
  const byEmail = await prisma.user.findFirst({
    where: { email: GIFT_OWNER_EMAIL, isActive: true },
  });
  if (byEmail) return byEmail;
  return prisma.user.findFirst({
    where: {
      isActive: true,
      role: "DEPARTMENT_MANAGER",
      department: { OR: [{ code: "MKT" }, { code: "MARKETING" }, { name: "Marketing" }] },
    },
  });
}

export async function gatePassApprover() {
  const byEmail = await prisma.user.findFirst({
    where: { email: GATE_PASS_OWNER_EMAIL, isActive: true },
  });
  if (byEmail) return byEmail;
  return prisma.user.findFirst({
    where: {
      isActive: true,
      department: { OR: [{ code: "HR" }, { name: { contains: "HR" } }] },
      role: { in: ["EMPLOYEE", "DEPARTMENT_MANAGER"] },
    },
  });
}

function guestName(visit: VisitParty) {
  return visit.visitors[0]?.visitor.fullName || "Guest";
}

function whenLabel(visit: VisitParty) {
  return [fmtDate(visit.visitDate), fmtTime(visit.expectedArrival)].filter(Boolean).join(" · ");
}

export async function startArrangements(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      createdBy: true,
      visitors: { include: { visitor: true } },
    },
  });
  if (!visit) return;

  const guest = guestName(visit);
  const when = whenLabel(visit);

  if (visit.driverRequired && !visit.driverStatus) {
    await prisma.visit.update({ where: { id: visitId }, data: { driverStatus: "PENDING" } });
    await notifyRoles(["HR_ADMIN", "SYSTEM_ADMIN"], {
      type: "DRIVER_NEEDED",
      title: `Driver needed · ${visit.visitCode}`,
      message: `${guest} · ${when}\nRequester: ${visit.createdBy.name}\nContact the driver, confirm the trip, add a note, and mark Done.`,
      visitId,
    });
  }

  if (visit.giftRequired && !visit.giftStatus) {
    await prisma.visit.update({ where: { id: visitId }, data: { giftStatus: "PENDING" } });
    const owner = await giftApprover();
    const gift = visit.giftType || "Protocol gift";
    if (owner) {
      await notify({
        userId: owner.id,
        type: "GIFT_REQUEST",
        title: `Gift request · ${visit.visitCode}`,
        message: `Hello ${owner.name},\n\nA protocol gift is requested for visitor ${guest}.\nGift type: ${gift}\nVisit: ${visit.visitCode}\nWhen: ${when}\nRequester: ${visit.createdBy.name}\nPurpose: ${visit.purpose}\n\nPlease approve so Reception can receive it.`,
        visitId,
        onBehalfOf: owner.name,
      });
    }
  }

  if (visit.gatePassRequired && !visit.gatePassStatus) {
    await prisma.visit.update({ where: { id: visitId }, data: { gatePassStatus: "PENDING" } });
    const owner = await gatePassApprover();
    if (owner) {
      await notify({
        userId: owner.id,
        type: "GATE_PASS_REQUEST",
        title: `Gate pass · ${visit.visitCode}`,
        message: `Hello ${owner.name},\n\nA gate pass is required for visitor ${guest}.\nVisit: ${visit.visitCode}\nWhen: ${when}\nRequester: ${visit.createdBy.name}\nPurpose: ${visit.purpose}\n\nPlease approve so Reception can issue it at the gate.`,
        visitId,
        onBehalfOf: owner.name,
      });
    }
  }
}

export async function markDriverDone(session: SessionUser, visitId: string, note: string) {
  if (!canManageIntake(session.role)) throw new Error("Reception or Administration can complete this.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  if (!visit.driverRequired) throw new Error("This visit did not request a driver.");
  const detail = note.trim();
  if (!detail) throw new Error("Add a short note that the driver was contacted and confirmed.");
  await prisma.visit.update({
    where: { id: visitId },
    data: { driverStatus: "DONE", driverNote: detail },
  });
  await addTimeline({ visitId, event: "Driver confirmed", note: detail, userId: session.id });
  await writeAudit({
    userId: session.id,
    visitId,
    action: "Driver arranged",
    module: "Arrangements",
    newValue: { note: detail },
  });
  await notify({
    userId: visit.createdById,
    type: "DRIVER_UPDATE",
    title: `Driver confirmed · ${visit.visitCode}`,
    message: `Hello ${visit.createdBy.name},\n\nReception confirmed the driver for ${guestName(visit)} (${visit.visitCode}).\n${detail}`,
    visitId,
    onBehalfOf: visit.createdBy.name,
  });
}

export async function approveGift(session: SessionUser, visitId: string, note: string) {
  if (!canApproveGift(session)) throw new Error("Marketing can approve this gift request.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  if (!visit.giftRequired) throw new Error("This visit did not request a gift.");
  if (visit.giftStatus === "DONE") throw new Error("This gift is already complete.");
  const detail = note.trim() || `Approved by ${session.name}. Preparing the gift.`;
  await prisma.visit.update({
    where: { id: visitId },
    data: { giftStatus: "PREPARING", giftNote: detail },
  });
  await addTimeline({ visitId, event: "Gift approved", note: detail, userId: session.id });
  await writeAudit({
    userId: session.id,
    visitId,
    action: "Gift approved",
    module: "Arrangements",
    newValue: { giftType: visit.giftType, note: detail },
  });
  await notify({
    userId: visit.createdById,
    type: "GIFT_UPDATE",
    title: `Gift preparing · ${visit.visitCode}`,
    message: `Hello ${visit.createdBy.name},\n\nMarketing approved the gift for ${guestName(visit)} (${visit.visitCode}).\nType: ${visit.giftType || "Protocol gift"}\nStatus: Preparing`,
    visitId,
    onBehalfOf: visit.createdBy.name,
  });
  await notifyRoles(["HR_ADMIN", "SYSTEM_ADMIN"], {
    type: "GIFT_READY",
    title: `Gift preparing · ${visit.visitCode}`,
    message: `${guestName(visit)} · ${visit.giftType || "Protocol gift"}\nMarketing approved. Mark Done when Reception receives it.`,
    visitId,
  });
}

export async function markGiftDone(session: SessionUser, visitId: string, note: string) {
  if (!canManageIntake(session.role)) throw new Error("Reception or Administration can complete this.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  if (!visit.giftRequired) throw new Error("This visit did not request a gift.");
  if (visit.giftStatus !== "PREPARING" && visit.giftStatus !== "DONE") {
    throw new Error("Wait for Marketing to approve the gift first.");
  }
  const detail = note.trim() || `Received at Reception by ${session.name}.`;
  await prisma.visit.update({
    where: { id: visitId },
    data: { giftStatus: "DONE", giftNote: detail },
  });
  await addTimeline({ visitId, event: "Gift received", note: detail, userId: session.id });
  await writeAudit({
    userId: session.id,
    visitId,
    action: "Gift received",
    module: "Arrangements",
    newValue: { note: detail },
  });
  await notify({
    userId: visit.createdById,
    type: "GIFT_UPDATE",
    title: `Gift ready · ${visit.visitCode}`,
    message: `Hello ${visit.createdBy.name},\n\nReception received the gift for ${guestName(visit)} (${visit.visitCode}).\nType: ${visit.giftType || "Protocol gift"}\nStatus: Done`,
    visitId,
    onBehalfOf: visit.createdBy.name,
  });
}

export async function approveGatePass(session: SessionUser, visitId: string, note: string) {
  if (!canApproveGatePass(session)) throw new Error("HR can approve this gate pass.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  if (!visit.gatePassRequired) throw new Error("This visit did not request a gate pass.");
  if (visit.gatePassStatus === "DONE") throw new Error("This gate pass is already complete.");
  const detail = note.trim() || `Approved by ${session.name}. Preparing the gate pass.`;
  await prisma.visit.update({
    where: { id: visitId },
    data: { gatePassStatus: "PREPARING", gatePassNote: detail },
  });
  await addTimeline({ visitId, event: "Gate pass approved", note: detail, userId: session.id });
  await writeAudit({
    userId: session.id,
    visitId,
    action: "Gate pass approved",
    module: "Arrangements",
    newValue: { note: detail },
  });
  await notify({
    userId: visit.createdById,
    type: "GATE_PASS_UPDATE",
    title: `Gate pass preparing · ${visit.visitCode}`,
    message: `Hello ${visit.createdBy.name},\n\nHR approved the gate pass for ${guestName(visit)} (${visit.visitCode}).\nStatus: Preparing`,
    visitId,
    onBehalfOf: visit.createdBy.name,
  });
  await notifyRoles(["HR_ADMIN", "SYSTEM_ADMIN"], {
    type: "GATE_PASS_READY",
    title: `Gate pass preparing · ${visit.visitCode}`,
    message: `${guestName(visit)} · Gate pass\nHR approved. Mark Done when Reception has the pass.`,
    visitId,
  });
}

export async function markGatePassDone(session: SessionUser, visitId: string, note: string) {
  if (!canManageIntake(session.role)) throw new Error("Reception or Administration can complete this.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  if (!visit.gatePassRequired) throw new Error("This visit did not request a gate pass.");
  if (visit.gatePassStatus !== "PREPARING" && visit.gatePassStatus !== "DONE") {
    throw new Error("Wait for HR to approve the gate pass first.");
  }
  const detail = note.trim() || `Received at Reception by ${session.name}.`;
  await prisma.visit.update({
    where: { id: visitId },
    data: { gatePassStatus: "DONE", gatePassNote: detail },
  });
  await addTimeline({ visitId, event: "Gate pass received", note: detail, userId: session.id });
  await writeAudit({
    userId: session.id,
    visitId,
    action: "Gate pass received",
    module: "Arrangements",
    newValue: { note: detail },
  });
  await notify({
    userId: visit.createdById,
    type: "GATE_PASS_UPDATE",
    title: `Gate pass ready · ${visit.visitCode}`,
    message: `Hello ${visit.createdBy.name},\n\nReception has the gate pass for ${guestName(visit)} (${visit.visitCode}).\nStatus: Done`,
    visitId,
    onBehalfOf: visit.createdBy.name,
  });
}

export async function listGiftQueue(session: SessionUser) {
  if (!canSeeGifts(session)) throw new Error("You cannot open gift requests.");
  return prisma.visit.findMany({
    where: {
      giftRequired: true,
      giftStatus: { in: ["PENDING", "PREPARING"] },
    },
    include: {
      createdBy: true,
      department: true,
      host: true,
      visitors: { include: { visitor: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listGatePassQueue(session: SessionUser) {
  if (!canSeePasses(session)) throw new Error("You cannot open gate pass requests.");
  return prisma.visit.findMany({
    where: {
      gatePassRequired: true,
      gatePassStatus: { in: ["PENDING", "PREPARING"] },
    },
    include: {
      createdBy: true,
      department: true,
      host: true,
      visitors: { include: { visitor: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
