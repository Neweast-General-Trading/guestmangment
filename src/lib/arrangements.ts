import { addTimeline, writeAudit } from "./audit";
import { GIFT_OWNER_EMAIL } from "./arrangement-types";
import { prisma } from "./prisma";
import { fmtDate, fmtTime } from "./format";
import { notify, notifyRoles } from "./notify";
import { isRoomBooker } from "./access";
import { canApproveGatePass, canApproveGift, canCompleteDriver, canManageIntake, canSeeGifts, canSeePasses, isGatePassApprover, type SessionUser } from "./permissions";
import { TERMINAL_STATUSES } from "./constants";
import { saveGatePassFile } from "./gate-pass-file";

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

export async function gatePassApprovers() {
  const people = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, name: true },
  });
  const owners = people.filter((person) => isGatePassApprover(person));
  if (owners.length) return owners;
  const fallback = await prisma.user.findFirst({
    where: {
      isActive: true,
      department: { OR: [{ code: "HR" }, { name: { contains: "HR" } }] },
      role: { in: ["EMPLOYEE", "DEPARTMENT_MANAGER"] },
    },
    select: { id: true, email: true, name: true },
  });
  return fallback ? [fallback] : [];
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
    const handlers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, name: true },
    });
    const owner = handlers.find((person) => isRoomBooker(person.email));
    if (owner) {
      await notify({
        userId: owner.id,
        type: "DRIVER_NEEDED",
        title: `Driver needed · ${visit.visitCode}`,
        message: `Hello ${owner.name},\n\nA driver is requested for ${guest}.\nVisit: ${visit.visitCode}\nWhen: ${when}\nRequester: ${visit.createdBy.name}\nPurpose: ${visit.purpose}\n\nContact the driver, then confirm the trip.`,
        visitId,
        onBehalfOf: owner.name,
      });
    }
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
    const owners = await gatePassApprovers();
    for (const owner of owners) {
      await notify({
        userId: owner.id,
        type: "GATE_PASS_REQUEST",
        title: `Gate pass · ${visit.visitCode}`,
        message: `Hello ${owner.name},\n\nA gate pass is required for visitor ${guest}.\nVisit: ${visit.visitCode}\nWhen: ${when}\nRequester: ${visit.createdBy.name}\nPurpose: ${visit.purpose}\n\nApprove it, then upload the pass when it is ready.`,
        visitId,
        onBehalfOf: owner.name,
      });
    }
  }
}

export async function markDriverDone(session: SessionUser, visitId: string, note: string) {
  if (!canCompleteDriver(session)) throw new Error("Sachini confirms driver requests.");
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
    message: `Hello ${visit.createdBy.name},\n\nThe driver for ${guestName(visit)} (${visit.visitCode}) is confirmed.\n${detail}`,
    visitId,
    onBehalfOf: visit.createdBy.name,
  });
}

export async function approveGift(session: SessionUser, visitId: string, note: string, linkId?: string) {
  if (!canApproveGift(session)) throw new Error("Marketing can approve this gift request.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  if (!visit.giftRequired && !visit.visitors.some((link) => link.giftRequired)) throw new Error("This visit did not request a gift.");
  if (visit.giftStatus === "DONE" && !linkId) throw new Error("This gift is already complete.");
  const detail = note.trim() || `Approved by ${session.name}. Preparing the gift.`;
  if (linkId) {
    if (visit.giftRequired && visit.visitors.every((link) => !link.giftRequired)) {
      await prisma.visitVisitor.updateMany({
        where: { visitId },
        data: { giftRequired: true, giftStatus: "PENDING", giftType: visit.giftType },
      });
    }
    const link = await prisma.visitVisitor.findFirst({ where: { id: linkId, visitId }, include: { visitor: true } });
    if (!link) throw new Error("That guest is not on this visit.");
    if (link.giftStatus === "DONE") throw new Error("This gift is already complete.");
    await prisma.visitVisitor.update({
      where: { id: link.id },
      data: { giftRequired: true, giftStatus: "PREPARING", giftNote: detail, giftType: link.giftType || visit.giftType },
    });
    await prisma.visit.update({ where: { id: visitId }, data: { giftRequired: true, giftStatus: "PREPARING", giftNote: detail } });
    await addTimeline({ visitId, event: "Gift approved", note: `${link.visitor.fullName}: ${detail}`, userId: session.id });
    await writeAudit({
      userId: session.id,
      visitId,
      action: "Gift approved",
      module: "Arrangements",
      newValue: { giftType: link.giftType || visit.giftType, note: detail, guest: link.visitor.fullName },
    });
    await notify({
      userId: visit.createdById,
      type: "GIFT_UPDATE",
      title: `Gift preparing · ${visit.visitCode}`,
      message: `Hello ${visit.createdBy.name},\n\nMarketing approved the gift for ${link.visitor.fullName} (${visit.visitCode}).\nType: ${link.giftType || visit.giftType || "Protocol gift"}\nStatus: Preparing`,
      visitId,
      onBehalfOf: visit.createdBy.name,
    });
    return;
  }
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

export async function markGiftDone(session: SessionUser, visitId: string, note: string, linkId?: string) {
  if (!canManageIntake(session.role)) throw new Error("Reception or Administration can complete this.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  if (!visit.giftRequired && !visit.visitors.some((link) => link.giftRequired)) throw new Error("This visit did not request a gift.");
  const detail = note.trim() || `Received at Reception by ${session.name}.`;
  if (linkId) {
    const link = await prisma.visitVisitor.findFirst({ where: { id: linkId, visitId }, include: { visitor: true } });
    if (!link?.giftRequired && !visit.giftRequired) throw new Error("This guest did not request a gift.");
    if (link && link.giftStatus !== "PREPARING" && link.giftStatus !== "DONE" && visit.giftStatus !== "PREPARING") {
      throw new Error("Wait for Marketing to approve the gift first.");
    }
    if (!link) throw new Error("That guest is not on this visit.");
    await prisma.visitVisitor.update({
      where: { id: link.id },
      data: { giftRequired: true, giftStatus: "DONE", giftNote: detail },
    });
    const links = await prisma.visitVisitor.findMany({ where: { visitId, giftRequired: true } });
    const done = links.length > 0 && links.every((item) => item.giftStatus === "DONE");
    await prisma.visit.update({
      where: { id: visitId },
      data: { giftStatus: done ? "DONE" : "PREPARING", giftNote: detail },
    });
    await addTimeline({ visitId, event: "Gift received", note: `${link.visitor.fullName}: ${detail}`, userId: session.id });
    await writeAudit({
      userId: session.id,
      visitId,
      action: "Gift received",
      module: "Arrangements",
      newValue: { note: detail, guest: link.visitor.fullName },
    });
    await notify({
      userId: visit.createdById,
      type: "GIFT_UPDATE",
      title: `Gift ready · ${visit.visitCode}`,
      message: `Hello ${visit.createdBy.name},\n\nReception received the gift for ${link.visitor.fullName} (${visit.visitCode}).\nStatus: ${done ? "Done" : "Preparing"}`,
      visitId,
      onBehalfOf: visit.createdBy.name,
    });
    return;
  }
  if (visit.giftStatus !== "PREPARING" && visit.giftStatus !== "DONE") {
    throw new Error("Wait for Marketing to approve the gift first.");
  }
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

export async function approveGatePass(session: SessionUser, visitId: string, note: string, linkId?: string) {
  if (!canApproveGatePass(session)) throw new Error("Reception can approve this gate pass.");
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  if (!visit.gatePassRequired && !visit.visitors.some((link) => link.gatePassRequired)) {
    throw new Error("This visit did not request a gate pass.");
  }
  if (visit.gatePassStatus === "DONE") throw new Error("This gate pass is already complete.");
  const detail = note.trim() || `Approved by ${session.name}.`;
  if (linkId) {
    const link = await prisma.visitVisitor.findFirst({
      where: { id: linkId, visitId },
      include: { visitor: true },
    });
    if (!link) throw new Error("That guest is not on this visit.");
    if (link.gatePassStatus === "DONE") throw new Error("This gate pass is already complete.");
    await prisma.visitVisitor.update({
      where: { id: link.id },
      data: { gatePassRequired: true, gatePassStatus: "PREPARING", gatePassNote: detail },
    });
    await prisma.visit.update({
      where: { id: visitId },
      data: { gatePassRequired: true, gatePassStatus: "PREPARING", gatePassNote: detail },
    });
    await addTimeline({
      visitId,
      event: "Gate pass approved",
      note: `${link.visitor.fullName}: ${detail}`,
      userId: session.id,
    });
    await writeAudit({
      userId: session.id,
      visitId,
      action: "Gate pass approved",
      module: "Arrangements",
      newValue: { note: detail, guest: link.visitor.fullName },
    });
    await notify({
      userId: visit.createdById,
      type: "GATE_PASS_UPDATE",
      title: `Gate pass approved · ${visit.visitCode}`,
      message: `Hello ${visit.createdBy.name},\n\nReception approved the gate pass for ${link.visitor.fullName} (${visit.visitCode}).\nThe file will be uploaded next.`,
      visitId,
      onBehalfOf: visit.createdBy.name,
    });
    return;
  }
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
    message: `Hello ${visit.createdBy.name},\n\nReception approved the gate pass for ${guestName(visit)} (${visit.visitCode}).\nStatus: Preparing. The file will be uploaded when it is ready.`,
    visitId,
    onBehalfOf: visit.createdBy.name,
  });
}

export async function markGatePassDone(session: SessionUser, visitId: string, note: string, file?: File | null, linkId?: string) {
  if (!canManageIntake(session.role) && !canApproveGatePass(session)) {
    throw new Error("Reception uploads the gate pass.");
  }
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { createdBy: true, visitors: { include: { visitor: true } } },
  });
  if (!visit) throw new Error("Visit not found.");
  if (!visit.gatePassRequired && !visit.visitors.some((link) => link.gatePassRequired)) {
    throw new Error("This visit did not request a gate pass.");
  }
  const detail = note.trim() || `Uploaded by ${session.name}.`;
  if (linkId) {
    const current = visit.visitors.find((item) => item.id === linkId);
    if (!current) throw new Error("That guest is not on this visit.");
    const ownReady = current.gatePassStatus === "PREPARING" || current.gatePassStatus === "DONE";
    const visitReady = !current.gatePassStatus && (visit.gatePassStatus === "PREPARING" || visit.gatePassStatus === "DONE");
    if (!ownReady && !visitReady) throw new Error("Approve the gate pass before uploading the file.");
    if (visitReady) {
      await prisma.visitVisitor.updateMany({
        where: { visitId, gatePassStatus: null },
        data: { gatePassRequired: true, gatePassStatus: "PREPARING" },
      });
    }
    const link = await prisma.visitVisitor.findFirst({
      where: { id: linkId, visitId },
      include: { visitor: true },
    });
    if (!link) throw new Error("That guest is not on this visit.");
    const saved = await saveGatePassFile(visitId, file, linkId);
    await prisma.visitVisitor.update({
      where: { id: link.id },
      data: { gatePassRequired: true, gatePassStatus: "DONE", gatePassNote: detail, gatePassFile: saved.name },
    });
    const links = await prisma.visitVisitor.findMany({ where: { visitId, gatePassRequired: true } });
    const done = links.length > 0 && links.every((item) => item.gatePassStatus === "DONE");
    await prisma.visit.update({
      where: { id: visitId },
      data: { gatePassRequired: true, gatePassStatus: done ? "DONE" : "PREPARING", gatePassNote: detail },
    });
    await addTimeline({
      visitId,
      event: "Gate pass received",
      note: `${link.visitor.fullName}: ${detail}`,
      userId: session.id,
    });
    await writeAudit({
      userId: session.id,
      visitId,
      action: "Gate pass received",
      module: "Arrangements",
      newValue: { note: detail, guest: link.visitor.fullName },
    });
    await notify({
      userId: visit.createdById,
      type: "GATE_PASS_UPDATE",
      title: `Gate pass ready · ${visit.visitCode}`,
      message: `Hello ${visit.createdBy.name},\n\nReception uploaded the gate pass for ${link.visitor.fullName} (${visit.visitCode}).\nStatus: ${done ? "Done" : "Preparing"}`,
      visitId,
      onBehalfOf: visit.createdBy.name,
    });
    return;
  }
  if (visit.gatePassStatus !== "PREPARING" && visit.gatePassStatus !== "DONE") {
    throw new Error("Approve the gate pass before uploading the file.");
  }
  const saved = await saveGatePassFile(visitId, file);
  await prisma.visit.update({
    where: { id: visitId },
    data: { gatePassStatus: "DONE", gatePassNote: detail, gatePassFile: saved.name },
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
    message: `Hello ${visit.createdBy.name},\n\nReception uploaded the gate pass for ${guestName(visit)} (${visit.visitCode}).\nStatus: Done`,
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
  const now = new Date();
  return prisma.visit.findMany({
    where: {
      status: { notIn: [...TERMINAL_STATUSES] },
      expectedArrival: { gte: now },
      OR: [
        { gatePassRequired: true, gatePassStatus: { in: ["PENDING", "PREPARING"] } },
        { visitors: { some: { gatePassRequired: true, gatePassStatus: { in: ["PENDING", "PREPARING"] } } } },
        { gatePassRequired: true, gatePassStatus: "DONE" },
        { gatePassFile: { not: null } },
        { visitors: { some: { gatePassFile: { not: null } } } },
      ],
    },
    include: {
      createdBy: true,
      department: true,
      host: true,
      visitors: { include: { visitor: true }, orderBy: [{ sortOrder: "asc" }, { isPrimary: "desc" }] },
    },
    orderBy: { createdAt: "desc" },
  });
}
