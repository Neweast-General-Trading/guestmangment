"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, requireSession } from "@/lib/auth";
import { decideApproval, stepsFromPresetCodes } from "@/lib/approvals";
import { applyLifecycle } from "@/lib/lifecycle";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  assignParkingSlot,
  cancelVisit,
  checkIn,
  checkOut,
  recordVisitVehicle,
  processQrAtGate,
  createVisit,
  markArrived,
  markInMeeting,
  registerWalkIn,
  sendInvitation,
  setVisitorRestricted,
  submitVisit,
  updateVisit,
  verifyVisitor,
  type VisitDraft,
} from "@/lib/visits";
import { parseQrPayload } from "@/lib/qr";
import { accessHref, canManageAccess, parseAccessGroup, parseAccessPage, parseAccessPageSize, parseAssignableRole } from "@/lib/access";
import { assignStaffParking, releaseStaffParking } from "@/lib/parking-assign";
import { canDecideEscalation, canManageConfig, canManageIntake, canManageServiceMaster, canOperateGate } from "@/lib/permissions";
import { bookStaffRoomHold, cancelStaffRoomHold } from "@/lib/room-booking";
import { assertFutureVisit } from "@/lib/visit-schedule";
import { confirmIntake, decideEscalation, escalateIntake, ingestEmailText, submitIntake, updateIntakeVisit } from "@/lib/intake";
import { approveGatePass, approveGift, giftFromForm, markDriverDone, markGatePassDone, markGiftDone } from "@/lib/arrangements";
import { createStaffRequest, decideStaffRequest } from "@/lib/staff-request";
import { syncGuestInbox } from "@/lib/inbox-sync";
import { isKnownGuestKind } from "@/lib/email-template";
import { fromForm } from "@/lib/hospitality";
import { codeFromLabel, isOperationalStaff, updateServiceTask } from "@/lib/service-master";
import { syncPayrollEmployees } from "@/lib/payroll";
import { safeNext } from "@/lib/safe-next";

function refresh() {
  revalidatePath("/", "layout");
}

export async function loginAction() {
  return { error: "Sign in from the intranet." };
}

export async function logoutAction() {
  const session = await requireSession();
  await clearSession();
  if (session) await writeAudit({ userId: session.id, action: "Signed out", module: "Auth" });
  redirect("/login");
}

export async function runLifecycleAction() {
  await applyLifecycle();
  refresh();
}

function draftFrom(formData: FormData): VisitDraft {
  const type = String(formData.get("type") || "CUSTOMER");
  const visitorType = type === "EMPLOYEE_VISIT" ? "CANDIDATE" : type === "WALK_IN" ? "GUEST" : "CUSTOMER";
  const visitorCount = Number(formData.get("visitorCount") || 1);
  const visitors = [];
  for (let i = 0; i < visitorCount; i += 1) {
    const fullName = String(formData.get(`visitor_${i}_fullName`) || "").trim();
    if (!fullName) continue;
    visitors.push({
      fullName,
      mobile: String(formData.get(`visitor_${i}_mobile`) || "").trim(),
      email: String(formData.get(`visitor_${i}_email`) || ""),
      nationality: String(formData.get(`visitor_${i}_nationality`) || ""),
      company: String(formData.get(`visitor_${i}_company`) || ""),
      jobTitle: String(formData.get(`visitor_${i}_jobTitle`) || ""),
      visitorType,
      idType: String(formData.get(`visitor_${i}_idType`) || ""),
      idReference: String(formData.get(`visitor_${i}_idReference`) || ""),
    });
  }
  return {
    type,
    purpose: String(formData.get("purpose") || ""),
    description: String(formData.get("description") || ""),
    visitDate: String(formData.get("visitDate") || ""),
    expectedArrival: String(formData.get("expectedArrival") || ""),
    expectedDeparture: String(formData.get("expectedDeparture") || ""),
    hostId: String(formData.get("hostId") || "") || undefined,
    departmentId: String(formData.get("departmentId") || ""),
    location: String(formData.get("location") || ""),
    meetingRoom: String(formData.get("meetingRoom") || ""),
    parkingRequired: formData.get("parkingRequired") === "on",
    specialRequirements: String(formData.get("specialRequirements") || ""),
    internalNotes: String(formData.get("internalNotes") || ""),
    vip: formData.get("vip") === "on" || String(formData.get("type")) === "VIP",
    accessArea: String(formData.get("accessArea") || ""),
    visitors,
    vehiclePlate: String(formData.get("vehiclePlate") || ""),
    vehicleType: String(formData.get("vehicleType") || ""),
    parkingSlot: String(formData.get("parkingSlot") || ""),
    submit: formData.get("intent") === "submit",
    hospitality: fromForm(formData),
  };
}

export async function saveVisitAction(_prev: { error?: string } | null, formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  const draft = draftFrom(formData);
  let visit;
  try {
    visit = visitId
      ? await updateVisit(session, visitId, draft)
      : await createVisit(session, draft);
    if (draft.submit && visitId) await submitVisit(session, visit.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save visit." };
  }
  refresh();
  redirect(`/visits?saved=${encodeURIComponent(visit.visitCode)}`);
}

export async function submitVisitAction(visitId: string) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await submitVisit(session, visitId);
  refresh();
}

export async function cancelVisitAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId"));
  const reason = String(formData.get("reason") || "Cancelled");
  const source = session.role === "HR_ADMIN" || session.role === "SYSTEM_ADMIN" ? "ADMIN" : "HOST";
  await cancelVisit(session, visitId, reason, source);
  refresh();
}

export async function decideAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId"));
  const decision = String(formData.get("decision")) as "APPROVED" | "REJECTED" | "INFO_REQUESTED";
  const comments = String(formData.get("comments") || "");
  let result: { status: string };
  try {
    result = await decideApproval({ visitId, actor: session, decision, comments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval failed.";
    redirect(`/visits/${visitId}?error=${encodeURIComponent(message)}`);
  }
  if (result.status === "APPROVED") {
    const visit = await prisma.visit.findUnique({ where: { id: visitId }, select: { type: true } });
    if (visit && visit.type !== "WALK_IN") {
      try {
        await sendInvitation(session, visitId, "EMAIL");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invitation email failed.";
        redirect(`/visits/${visitId}?error=${encodeURIComponent(message)}`);
      }
    }
  }
  refresh();
}

export async function inviteAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId"));
  try {
    await sendInvitation(session, visitId, String(formData.get("channel") || "EMAIL") as "EMAIL" | "WHATSAPP");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invitation email failed.";
    redirect(`/visits/${visitId}?error=${encodeURIComponent(message)}`);
  }
  refresh();
}

export async function scanCheckInAction(formData: FormData) {
  const raw = String(formData.get("qr") || "");
  const from = String(formData.get("from") || "security");
  const token = parseQrPayload(raw);
  const fail = (message: string) => {
    if (from === "invite" && token) {
      redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(message)}`);
    }
    redirect(`/security?error=${encodeURIComponent(message)}`);
  };

  const session = await requireSession();
  if (!session) {
    redirect(from === "invite" && token ? `/login?next=/invite/${encodeURIComponent(token)}` : "/login?next=/security");
  }
  if (!canOperateGate(session.role)) fail("Only security can check in or out from a QR scan.");
  const gate = String(formData.get("gate") || "in") === "out" ? "out" : "in";
  try {
    const result = await processQrAtGate(session, raw, gate, {
      parkingSlot: String(formData.get("parkingSlot") || "") || undefined,
    });
    redirect(`/visits/${result.visitId}`);
  } catch (error) {
    fail(error instanceof Error ? error.message : "QR scan failed.");
  }
}

export async function walkInAction(_prev: { error?: string } | null, formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canOperateGate(session.role) && session.role !== "HR_ADMIN") {
    return { error: "Only security or administration can register walk-ins." };
  }
  let visit;
  try {
    visit = await registerWalkIn(session, draftFrom(formData));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to register walk-in." };
  }
  refresh();
  redirect(`/visits?saved=${encodeURIComponent(visit.visitCode)}`);
}

export async function verifyAction(visitId: string) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await verifyVisitor(session, visitId);
  refresh();
}

export async function arriveAction(visitId: string) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await markArrived(session, visitId);
  refresh();
}

export async function checkInAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await checkIn(session, String(formData.get("visitId")), {
    entryGate: String(formData.get("entryGate") || "Main Gate"),
    notes: String(formData.get("notes") || ""),
    badgeNumber: String(formData.get("badgeNumber") || "") || undefined,
    parkingSlot: String(formData.get("parkingSlot") || "") || undefined,
    vehiclePlate: String(formData.get("vehiclePlate") || "") || undefined,
    vehicleType: String(formData.get("vehicleType") || "") || undefined,
    checkInAt: String(formData.get("checkInAt") || "") || undefined,
  });
  refresh();
}

export async function saveVehicleAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await recordVisitVehicle(session, String(formData.get("visitId")), {
    vehiclePlate: String(formData.get("vehiclePlate") || "") || undefined,
    vehicleType: String(formData.get("vehicleType") || "") || undefined,
    parkingSlot: String(formData.get("parkingSlot") || "") || undefined,
  });
  refresh();
}

export async function saveParkingAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  await assignParkingSlot(session, visitId, String(formData.get("parkingSlot") || ""));
  refresh();
}

export async function assignStaffParkingAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const slot = String(formData.get("slot") || "").trim().toUpperCase();
  let movedFrom = "";
  try {
    const result = await assignStaffParking(session, slot, String(formData.get("userId") || ""), {
      plates: formData.getAll("plate").map((value) => String(value)),
      types: formData.getAll("vehicleType").map((value) => String(value)),
    });
    movedFrom = result.movedFrom || "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reserve this bay.";
    redirect(`/assign-parking?error=${encodeURIComponent(message)}`);
  }
  refresh();
  redirect(`/assign-parking?assigned=${encodeURIComponent(slot)}${movedFrom ? `&moved=${encodeURIComponent(movedFrom)}` : ""}`);
}

export async function releaseStaffParkingAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const slot = String(formData.get("slot") || "").trim().toUpperCase();
  try {
    await releaseStaffParking(session, slot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not release this bay.";
    redirect(`/assign-parking?error=${encodeURIComponent(message)}`);
  }
  refresh();
  redirect(`/assign-parking?released=${encodeURIComponent(slot)}`);
}

export async function checkOutAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await checkOut(session, String(formData.get("visitId")), {
    exitGate: String(formData.get("exitGate") || "Main Gate"),
    badgeReturned: formData.get("badgeReturned") !== "off",
    notes: String(formData.get("notes") || ""),
    checkOutAt: String(formData.get("checkOutAt") || "") || undefined,
  });
  refresh();
}

export async function inMeetingAction(visitId: string) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await markInMeeting(session, visitId);
  refresh();
}

export async function restrictVisitorAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageConfig(session.role)) return;
  await setVisitorRestricted(
    session,
    String(formData.get("visitorId")),
    formData.get("restricted") === "on",
    String(formData.get("note") || ""),
  );
  refresh();
}

export async function markReadAction(id: string) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await prisma.notification.updateMany({
    where: { id, userId: session.id },
    data: { read: true },
  });
  refresh();
}

export async function markAllReadAction() {
  const session = await requireSession();
  if (!session) redirect("/login");
  await prisma.notification.updateMany({
    where: { userId: session.id, read: false },
    data: { read: true },
  });
  refresh();
}

export async function saveSettingsAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageConfig(session.role)) return;
  const entries = [
    "appointment_window_minutes",
    "data_retention_days",
    "invite_instructions",
    "parking_instructions",
    "location_instructions",
    "badge_prefix",
    "teams_webhook",
  ];
  for (const key of entries) {
    if (!formData.has(key)) continue;
    const value = String(formData.get(key) ?? "").trim();
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  await writeAudit({ userId: session.id, action: "Settings updated", module: "Configuration" });
  refresh();
}

export async function saveLookupsAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageConfig(session.role)) return;
  const kind = String(formData.get("kind"));
  const code = String(formData.get("code")).toUpperCase().replace(/\s+/g, "_");
  const label = String(formData.get("label"));
  await prisma.lookup.upsert({
    where: { kind_code: { kind, code } },
    update: { label, active: true },
    create: { kind, code, label },
  });
  refresh();
}

export async function saveRuleAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageConfig(session.role)) return;
  const steps = stepsFromPresetCodes(formData.getAll("level").map(String));
  if (!steps.length) return;
  await prisma.approvalRule.create({
    data: {
      visitType: String(formData.get("visitType")),
      departmentCode: String(formData.get("departmentCode") || "") || null,
      visitorCategory: String(formData.get("visitorCategory") || "") || null,
      vip: false,
      stepsJson: JSON.stringify(steps),
      isActive: true,
    },
  });
  await writeAudit({ userId: session.id, action: "Approval rule created", module: "Configuration" });
  refresh();
}

export async function syncPayrollAction() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageConfig(session.role)) return;
  await syncPayrollEmployees();
  await writeAudit({ userId: session.id, action: "Payroll employees refreshed", module: "Configuration" });
  refresh();
}

export async function toggleRuleAction(id: string, isActive: boolean) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await prisma.approvalRule.update({ where: { id }, data: { isActive } });
  refresh();
}

export async function saveGuestServiceAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageServiceMaster(session.role)) redirect("/dashboard");
  const id = String(formData.get("id") || "");
  const label = String(formData.get("label") || "").trim();
  if (label.length < 2) redirect("/master/services?error=Name%20is%20required");
  const hint = String(formData.get("hint") || "").trim() || "General service";
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "other");
  const maps = String(formData.get("maps") || "") || null;
  const active = formData.get("active") === "on";
  const requestedOwnerIds = [...new Set(formData.getAll("ownerId").map(String).filter(Boolean))];
  const allowedOwners = requestedOwnerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: requestedOwnerIds }, isActive: true, payrollNo: { not: null }, role: "EMPLOYEE" },
        select: { id: true, jobTitle: true, isActive: true, payrollNo: true, role: true },
      })
    : [];
  const ownerIds = allowedOwners.filter(isOperationalStaff).map((user) => user.id);
  const code = id
    ? undefined
    : codeFromLabel(String(formData.get("code") || label));

  let serviceId = id;
  if (id) {
    await prisma.guestService.update({
      where: { id },
      data: { label, hint, description: description || null, category, maps, active },
    });
    await prisma.guestServiceOwner.deleteMany({ where: { serviceId: id } });
  } else {
    const exists = await prisma.guestService.findUnique({ where: { code: code as string } });
    if (exists) redirect("/master/services/new?error=Code%20already%20exists");
    const created = await prisma.guestService.create({
      data: {
        code: code as string,
        label,
        hint,
        description: description || null,
        category,
        maps,
        active,
        sortOrder: (await prisma.guestService.count()) + 1,
      },
    });
    serviceId = created.id;
  }
  if (ownerIds.length) {
    await prisma.guestServiceOwner.createMany({
      data: ownerIds.map((userId) => ({ serviceId, userId })),
    });
  }
  await writeAudit({
    userId: session.id,
    action: id ? "Service master updated" : "Service master created",
    module: "Service master",
    newValue: { id: serviceId, label },
  });
  refresh();
  redirect("/master/services");
}

export async function updateServiceTaskAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const taskId = String(formData.get("taskId") || "");
  const status = String(formData.get("status") || "IN_PROGRESS");
  const note = String(formData.get("note") || "");
  const visitId = await updateServiceTask(session, taskId, { status, note });
  refresh();
  const from = String(formData.get("from") || "services");
  redirect(from === "visit" ? `/visits/${visitId}` : "/services");
}

function intakeVisitorsFrom(formData: FormData) {
  const count = Number(formData.get("visitorCount") || 1);
  const visitors = [];
  for (let i = 0; i < count; i += 1) {
    const fullName = String(formData.get(`visitor_${i}_fullName`) || "").trim();
    const mobile = String(formData.get(`visitor_${i}_mobile`) || "").trim();
    if (!fullName || !mobile) continue;
    visitors.push({
      fullName,
      mobile,
      email: String(formData.get(`visitor_${i}_email`) || ""),
      company: String(formData.get(`visitor_${i}_company`) || ""),
      jobTitle: String(formData.get(`visitor_${i}_jobTitle`) || ""),
      nationality: String(formData.get(`visitor_${i}_nationality`) || ""),
    });
  }
  return visitors;
}

async function saveIntakeFromForm(session: NonNullable<Awaited<ReturnType<typeof requireSession>>>, formData: FormData) {
  const visitId = String(formData.get("visitId") || "");
  const guestKind = String(formData.get("guestKind") || "GUEST");
  if (!isKnownGuestKind(guestKind)) throw new Error("Choose a guest type.");
  await updateIntakeVisit(session, visitId, {
    visitDate: String(formData.get("visitDate") || ""),
    expectedArrival: String(formData.get("expectedArrival") || ""),
    departmentId: String(formData.get("departmentId") || ""),
    hostId: String(formData.get("hostId") || "") || undefined,
    guestKind,
    purpose: String(formData.get("purpose") || ""),
    meetingRoom: String(formData.get("meetingRoom") || ""),
    driverRequired: formData.get("driverRequired") === "on" || formData.get("driverRequired") === "Yes",
    driverName: String(formData.get("driverName") || ""),
    driverMobile: String(formData.get("driverMobile") || ""),
    driverVehicle: String(formData.get("driverVehicle") || ""),
    visitors: intakeVisitorsFrom(formData),
  });
  return visitId;
}

function intakeFail(path: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to update intake.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function submitStaffRequestAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  let code = "";
  let manager = "";
  try {
    const rows = Number(formData.get("visitorRows") || 1);
    const visitors = [];
    for (let index = 0; index < rows; index += 1) {
      const fullName = String(formData.get(`fullName_${index}`) || "").trim();
      if (!fullName) continue;
      visitors.push({
        fullName,
        mobile: String(formData.get(`mobile_${index}`) || ""),
        email: String(formData.get(`email_${index}`) || ""),
        company: String(formData.get(`company_${index}`) || ""),
        jobTitle: String(formData.get(`jobTitle_${index}`) || ""),
        nationality: String(formData.get(`nationality_${index}`) || ""),
      });
    }
    const kind = String(formData.get("guestKind") || "GUEST");
    if (!isKnownGuestKind(kind)) throw new Error("Choose a guest type.");
    const result = await createStaffRequest(session, {
      visitDate: String(formData.get("visitDate") || ""),
      arrivalTime: String(formData.get("arrivalTime") || ""),
      departmentId: String(formData.get("departmentId") || ""),
      guestKind: kind,
      purpose: String(formData.get("purpose") || ""),
      driverRequired: formData.get("driverRequired") === "yes",
      gatePassRequired: formData.get("gatePassRequired") === "yes",
      ...giftFromForm(formData),
      visitors,
    });
    code = result.visit.visitCode;
    manager = result.managerName || "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the request.";
    redirect(`/request?error=${encodeURIComponent(message)}`);
  }
  refresh();
  redirect(`/request?tab=new&sent=${encodeURIComponent(code)}${manager ? `&manager=${encodeURIComponent(manager)}` : "&direct=1"}`);
}

export async function decideStaffRequestAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  const decision = String(formData.get("decision") || "") === "REJECTED" ? "REJECTED" : "APPROVED";
  try {
    await decideStaffRequest(session, visitId, decision, String(formData.get("note") || ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not decide the request.";
    redirect(`/request/${visitId}?error=${encodeURIComponent(message)}`);
  }
  refresh();
  redirect("/request?tab=approve&decided=1");
}

function arrangementFail(formData: FormData, visitId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Could not update this arrangement.";
  const from = String(formData.get("from") || "intake");
  const path = from === "gifts" ? "/gifts" : from === "passes" ? "/passes" : `/intake/${visitId}`;
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function completeDriverAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  try {
    await markDriverDone(session, visitId, String(formData.get("note") || ""));
  } catch (error) {
    arrangementFail(formData, visitId, error);
  }
  refresh();
  const from = String(formData.get("from") || "intake");
  redirect(from === "gifts" ? "/gifts?driver=1" : `/intake/${visitId}?driver=1`);
}

export async function approveGiftAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  try {
    await approveGift(session, visitId, String(formData.get("note") || ""));
  } catch (error) {
    arrangementFail(formData, visitId, error);
  }
  refresh();
  const from = String(formData.get("from") || "gifts");
  redirect(from === "intake" ? `/intake/${visitId}?gift=1` : "/gifts?approved=1");
}

export async function completeGiftAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  try {
    await markGiftDone(session, visitId, String(formData.get("note") || ""));
  } catch (error) {
    arrangementFail(formData, visitId, error);
  }
  refresh();
  const from = String(formData.get("from") || "intake");
  redirect(from === "gifts" ? "/gifts?received=1" : `/intake/${visitId}?gift=1`);
}

export async function approveGatePassAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  try {
    await approveGatePass(session, visitId, String(formData.get("note") || ""));
  } catch (error) {
    arrangementFail(formData, visitId, error);
  }
  refresh();
  const from = String(formData.get("from") || "passes");
  redirect(from === "intake" ? `/intake/${visitId}?pass=1` : "/passes?approved=1");
}

export async function completeGatePassAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  try {
    await markGatePassDone(session, visitId, String(formData.get("note") || ""));
  } catch (error) {
    arrangementFail(formData, visitId, error);
  }
  refresh();
  const from = String(formData.get("from") || "intake");
  redirect(from === "passes" ? "/passes?received=1" : `/intake/${visitId}?pass=1`);
}

export async function syncInboxAction() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  const result = await syncGuestInbox(session);
  refresh();
  if (!result.ok) redirect(`/intake?error=${encodeURIComponent(result.reason || "Inbox sync failed.")}`);
  redirect("/intake");
}

export async function importEmailAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  try {
    const result = await ingestEmailText(session, {
      text: String(formData.get("emailText") || ""),
      subject: String(formData.get("emailSubject") || "Pasted request"),
      from: String(formData.get("emailFrom") || ""),
    });
    refresh();
    redirect(`/intake/${result.visit.id}`);
  } catch (error) {
    intakeFail("/intake", error);
  }
}

export async function saveIntakeAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  try {
    await saveIntakeFromForm(session, formData);
  } catch (error) {
    intakeFail(`/intake/${visitId}`, error);
  }
  refresh();
  redirect(`/intake/${visitId}?saved=1`);
}

export async function confirmIntakeAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  try {
    await saveIntakeFromForm(session, formData);
    await confirmIntake(session, visitId, {
      meetingRoom: String(formData.get("meetingRoom") || ""),
      driverName: String(formData.get("driverName") || ""),
      driverMobile: String(formData.get("driverMobile") || ""),
      driverVehicle: String(formData.get("driverVehicle") || ""),
    });
  } catch (error) {
    intakeFail(`/intake/${visitId}`, error);
  }
  refresh();
  redirect(`/intake/${visitId}?confirmed=1`);
}

export async function escalateIntakeAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  try {
    await saveIntakeFromForm(session, formData);
    await escalateIntake(session, visitId, String(formData.get("escalationNotes") || ""));
  } catch (error) {
    intakeFail(`/intake/${visitId}`, error);
  }
  refresh();
  redirect(`/intake/${visitId}?escalated=1`);
}

export async function submitIntakeAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  const visitId = String(formData.get("visitId") || "");
  try {
    await saveIntakeFromForm(session, formData);
    await submitIntake(session, visitId);
  } catch (error) {
    intakeFail(`/intake/${visitId}`, error);
  }
  refresh();
  redirect("/security?queue=desk");
}

export async function decideEscalationAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canDecideEscalation(session)) redirect("/escalations");
  const visitId = String(formData.get("visitId") || "");
  const decision = String(formData.get("decision") || "") === "REJECTED" ? "REJECTED" : "APPROVED";
  try {
    await decideEscalation(session, visitId, decision, String(formData.get("notes") || ""));
  } catch (error) {
    intakeFail(formData.get("from") === "intake" ? `/intake/${visitId}` : "/escalations", error);
  }
  refresh();
  redirect(decision === "APPROVED" ? `/intake/${visitId}` : "/escalations?rejected=1");
}

function roomsFail(date: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Outlook could not book the room.";
  redirect(`/rooms?date=${encodeURIComponent(date)}&error=${encodeURIComponent(message)}`);
}

function clockValue(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export async function bookRoomTrialAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  const date = String(formData.get("date") || "");
  const start = clockValue(String(formData.get("start") || ""));
  const end = clockValue(String(formData.get("end") || ""));
  const roomName = String(formData.get("roomName") || "");
  const subject = String(formData.get("subject") || "Guest visit room hold").trim();
  const description = String(formData.get("description") || "").trim();
  try {
    if (!date || !start || !end || !roomName) throw new Error("Choose a room, date, and time.");
    assertFutureVisit(date, start);
    const from = new Date(`${date}T${start}:00+04:00`);
    const to = new Date(`${date}T${end}:00+04:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      throw new Error("End time must be after the start time.");
    }
    await bookStaffRoomHold(session, {
      roomName,
      start: from,
      end: to,
      subject,
      description,
      inviteEmails: formData.getAll("inviteEmail").map(String),
    });
  } catch (error) {
    roomsFail(date || "", error);
  }
  refresh();
  redirect(`/rooms?date=${encodeURIComponent(date)}&booked=1`);
}

function accessReturnPath(formData: FormData, extra?: Record<string, string>) {
  const href = accessHref({
    group: String(formData.get("group") || "").trim(),
    q: String(formData.get("q") || "").trim(),
    page: parseAccessPage(String(formData.get("page") || "")),
    pageSize: parseAccessPageSize(String(formData.get("pageSize") || "")),
  });
  if (!extra) return href;
  const url = new URL(href, "https://guest.neweast.cloud");
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

export async function updateUserAccessAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageAccess(session.email)) redirect("/dashboard");
  const userId = String(formData.get("userId") || "");
  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, accessGroup: true },
    });
    if (!target) throw new Error("Person not found.");
    const role = parseAssignableRole(formData.get("role"));
    const accessGroup = parseAccessGroup(formData.get("accessGroup"));
    if (target.email.toLowerCase() === session.email.toLowerCase() && !accessGroup) {
      throw new Error("Keep your own Guest Management access.");
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { role, accessGroup },
    });
    await writeAudit({
      userId: session.id,
      action: "Role updated",
      module: "Access",
      previousValue: { email: target.email, role: target.role, accessGroup: target.accessGroup },
      newValue: { email: target.email, role, accessGroup },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update access.";
    redirect(accessReturnPath(formData, { error: message }));
  }
  refresh();
  redirect(accessReturnPath(formData, { saved: "1" }));
}

export async function cancelRoomTrialAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  const date = String(formData.get("date") || "");
  const eventId = String(formData.get("eventId") || "");
  try {
    if (!eventId) throw new Error("Missing booking.");
    await cancelStaffRoomHold(session, eventId);
  } catch (error) {
    roomsFail(date, error);
  }
  refresh();
  redirect(`/rooms?date=${encodeURIComponent(date)}&cancelled=1`);
}
