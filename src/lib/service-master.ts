import { prisma } from "./prisma";
import { addTimeline } from "./audit";
import { notify } from "./notify";
import { hostServicesOpenedCopy, servicePrepCopy, serviceUpdateCopy, visitorNameOf } from "./notice-copy";
import { GUEST_NEEDS, parseGuestNeeds, type GuestNeedDef, type NeedFlag } from "./guest-needs";
import { fmtDate, fmtTime } from "./format";
import { ensurePayrollSynced } from "./payroll";
import type { SessionUser } from "./permissions";

export const TASK_STATUSES = [
  { code: "REQUESTED", label: "Requested" },
  { code: "IN_PROGRESS", label: "In progress" },
  { code: "DONE", label: "Done" },
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number]["code"];

const HR_STAY = ["deepak.rana@neweast.com", "navami.balachandran@neweast.co"];
const HR_TEAM = ["hansani@neweast.co", "sree@neweast.co", "sona.jacob@neweast.co"];
const RECEPTION = ["frontdesk@neweast.com", "sulthanghani.ne@gmail.com"];
const FACILITY = ["info.hq@neweast.co", "archana@neweast.co"];
const DRIVER = ["waylslym27@gmail.com"];

export function isManagerTitle(title?: string | null) {
  return /manager|director|function head|ceo|team lead|team leader/i.test(title || "");
}

export function isOperationalStaff(user: { isActive: boolean; payrollNo: string | null; role: string; jobTitle?: string | null }) {
  return user.isActive && Boolean(user.payrollNo) && user.role === "EMPLOYEE" && !isManagerTitle(user.jobTitle);
}

export function ownerEmailsFor(code: string, category: string) {
  if (code === "DRIVER" || code === "HQ_CAR") return [...DRIVER, RECEPTION[1]];
  if (code === "INTERPRETER" || code === "DOCS_TRANSLATION") return HR_TEAM.slice(0, 2);
  if (code === "VISA_HELP" || code === "FAMILY" || code === "CHILDCARE") return HR_STAY;
  if (code === "VIP_PROTOCOL" || code === "GIFT" || code === "FLAGS" || code === "HQ_TOUR" || code === "PHOTOGRAPHY") {
    return [HR_TEAM[2], HR_TEAM[0]];
  }
  if (category === "stay") return HR_STAY;
  if (category === "transport") return RECEPTION;
  if (category === "meals") return [RECEPTION[0], FACILITY[0]];
  if (category === "workplace") return FACILITY;
  if (category === "protocol") return RECEPTION;
  if (category === "other") return [RECEPTION[0], FACILITY[0]];
  return [];
}

export function serviceToNeed(row: { code: string; label: string; hint: string; category: string; maps: string | null }): GuestNeedDef {
  return {
    code: row.code,
    label: row.label,
    hint: row.hint,
    category: row.category as GuestNeedDef["category"],
    maps: (row.maps as NeedFlag | undefined) || undefined,
  };
}

export function isPayrollActiveStaff(user: { isActive: boolean; payrollNo: string | null; role: string }) {
  return user.isActive && Boolean(user.payrollNo) && user.role !== "SECURITY_GUARD";
}

export async function listAssignableStaff() {
  await ensurePayrollSynced();
  const users = await prisma.user.findMany({
    where: { isActive: true, payrollNo: { not: null }, role: "EMPLOYEE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, jobTitle: true, isActive: true, payrollNo: true, role: true },
  });
  return users.filter(isOperationalStaff).map(({ id, name, email, jobTitle }) => ({ id, name, email, jobTitle }));
}

export async function listActiveServices(): Promise<GuestNeedDef[]> {
  const rows = await prisma.guestService.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  if (!rows.length) return GUEST_NEEDS;
  return rows.map(serviceToNeed);
}

export async function upsertServiceCatalog() {
  for (const [index, item] of GUEST_NEEDS.entries()) {
    await prisma.guestService.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        label: item.label,
        hint: item.hint,
        description: item.hint,
        category: item.category,
        maps: item.maps ?? null,
        sortOrder: index,
        active: true,
      },
      update: {
        label: item.label,
        hint: item.hint,
        category: item.category,
        maps: item.maps ?? null,
        sortOrder: index,
        active: true,
      },
    });
  }
  await assignOperationalOwners();
}

export async function assignOperationalOwners() {
  const stamp = await prisma.systemSetting.findUnique({ where: { key: "service_owners_ops_v1" } });
  if (stamp?.value === "1") return;
  const services = await prisma.guestService.findMany({ select: { id: true, code: true, category: true } });
  const emails = [...new Set(services.flatMap((item) => ownerEmailsFor(item.code, item.category)))];
  const users = await prisma.user.findMany({
    where: { email: { in: emails }, isActive: true, payrollNo: { not: null }, role: "EMPLOYEE" },
    select: { id: true, email: true, jobTitle: true, isActive: true, payrollNo: true, role: true },
  });
  const byEmail = Object.fromEntries(users.filter(isOperationalStaff).map((user) => [user.email, user.id]));
  for (const service of services) {
    const ownerIds = [
      ...new Set(
        ownerEmailsFor(service.code, service.category)
          .map((email) => byEmail[email])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    await prisma.guestServiceOwner.deleteMany({ where: { serviceId: service.id } });
    if (ownerIds.length) {
      await prisma.guestServiceOwner.createMany({
        data: ownerIds.map((userId) => ({ serviceId: service.id, userId })),
      });
    }
  }
  await prisma.systemSetting.upsert({
    where: { key: "service_owners_ops_v1" },
    update: { value: "1" },
    create: { key: "service_owners_ops_v1", value: "1" },
  });
}

export function codeFromLabel(label: string) {
  const code = label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return code || "SERVICE";
}

export function groupTasksByOwner(
  items: Array<{
    requesterNotes: string | null;
    service: { label: string; owners: Array<{ user: { id: string; email: string; name: string } }> };
  }>,
) {
  const map = new Map<string, { id: string; email: string; name: string; services: Array<{ label: string; notes: string }> }>();
  for (const item of items) {
    for (const owner of item.service.owners) {
      const current = map.get(owner.user.id) ?? {
        id: owner.user.id,
        email: owner.user.email,
        name: owner.user.name,
        services: [],
      };
      current.services.push({ label: item.service.label, notes: item.requesterNotes || "" });
      map.set(owner.user.id, current);
    }
  }
  return [...map.values()];
}

export async function openServiceTasks(visitId: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      host: true,
      visitors: { include: { visitor: true }, orderBy: { isPrimary: "desc" } },
    },
  });
  if (!visit) return { created: 0, emailed: 0 };
  const needs = parseGuestNeeds(visit.guestNeedsJson);
  if (!needs.length) return { created: 0, emailed: 0 };

  const catalog = await prisma.guestService.findMany({
    where: { code: { in: needs.map((item) => item.code) }, active: true },
    include: { owners: { include: { user: true } } },
  });
  const notesByCode = Object.fromEntries(needs.map((item) => [item.code, item.notes]));
  const created: typeof catalog = [];

  for (const service of catalog) {
    const existing = await prisma.visitServiceTask.findUnique({
      where: { visitId_serviceId: { visitId, serviceId: service.id } },
    });
    if (existing) continue;
    await prisma.visitServiceTask.create({
      data: {
        visitId,
        serviceId: service.id,
        requesterNotes: notesByCode[service.code] || null,
        status: "REQUESTED",
      },
    });
    created.push(service);
  }

  if (!created.length) return { created: 0, emailed: 0 };

  const createdTasks = await prisma.visitServiceTask.findMany({
    where: { visitId, serviceId: { in: created.map((item) => item.id) } },
    include: { service: { include: { owners: { include: { user: true } } } } },
  });

  const visitorName = visitorNameOf(visit.visitors);
  const when = `${fmtDate(visit.visitDate)} · ${fmtTime(visit.expectedArrival)}`;
  const owners = groupTasksByOwner(createdTasks);
  const allServices = createdTasks.map((item) => ({
    label: item.service.label,
    notes: item.requesterNotes || "",
  }));

  for (const owner of owners) {
    const prep = servicePrepCopy({
      ownerName: owner.name,
      visitorName,
      visitCode: visit.visitCode,
      when,
      hostName: visit.host.name,
      services: allServices,
    });
    await notify({
      userId: owner.id,
      visitId,
      type: "SERVICE_PREP",
      title: prep.title,
      message: prep.message,
      onBehalfOf: owner.name,
    });
  }

  const labels = created.map((item) => item.label).join(", ");
  if (labels) {
    const hostCopy = hostServicesOpenedCopy({
      hostName: visit.host.name,
      visitorName,
      visitCode: visit.visitCode,
      labels,
    });
    await notify({
      userId: visit.hostId,
      visitId,
      type: "SERVICE_OPENED",
      title: hostCopy.title,
      message: hostCopy.message,
      onBehalfOf: visit.host.name,
    });
  }

  await addTimeline({
    visitId,
    event: "Service owners notified",
    note: labels,
  });

  return { created: created.length, emailed: owners.length };
}

export async function updateServiceTask(
  actor: SessionUser,
  taskId: string,
  input: { status: string; note?: string },
) {
  if (!TASK_STATUSES.some((item) => item.code === input.status)) {
    throw new Error("Unknown service status.");
  }
  const task = await prisma.visitServiceTask.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      service: { include: { owners: true } },
      visit: { include: { host: true, visitors: { include: { visitor: true }, orderBy: { isPrimary: "desc" } } } },
    },
  });
  const owns = task.service.owners.some((item) => item.userId === actor.id);
  if (!owns && actor.role !== "SYSTEM_ADMIN") {
    throw new Error("You are not assigned to this service.");
  }
  const note = input.note?.trim() || null;
  await prisma.visitServiceTask.update({
    where: { id: taskId },
    data: { status: input.status },
  });
  await prisma.visitServiceUpdate.create({
    data: { taskId, status: input.status, note, userId: actor.id },
  });
  await addTimeline({
    visitId: task.visitId,
    event: `${task.service.label} · ${input.status.replaceAll("_", " ").toLowerCase()}`,
    note: note ?? undefined,
    userId: actor.id,
  });
  const statusLabel = TASK_STATUSES.find((item) => item.code === input.status)?.label || input.status;
  const update = serviceUpdateCopy({
    hostName: task.visit.host.name,
    actorName: actor.name,
    visitorName: visitorNameOf(task.visit.visitors),
    visitCode: task.visit.visitCode,
    service: task.service.label,
    status: statusLabel,
    note,
  });
  await notify({
    userId: task.visit.hostId,
    visitId: task.visitId,
    type: "SERVICE_UPDATE",
    title: update.title,
    message: update.message,
    onBehalfOf: actor.name,
  });
  return task.visitId;
}
