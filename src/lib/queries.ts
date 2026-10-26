import { endOfDay, startOfDay, subDays } from "date-fns";
import { prisma } from "./prisma";
import { visitInclude, visitWhereFor } from "./visits";
import type { SessionUser } from "./permissions";
import { Prisma } from "@prisma/client";
import { listActiveServices } from "./service-master";

export async function searchVisits(user: SessionUser, params: {
  q?: string;
  status?: string;
  type?: string;
  departmentId?: string;
  from?: string;
  to?: string;
  hostId?: string;
  take?: number;
}) {
  const AND: Prisma.VisitWhereInput[] = [visitWhereFor(user)];
  if (params.status) AND.push({ status: params.status });
  if (params.type) AND.push({ type: params.type });
  if (params.departmentId) AND.push({ departmentId: params.departmentId });
  if (params.hostId) AND.push({ hostId: params.hostId });
  if (params.from || params.to) {
    AND.push({
      visitDate: {
        gte: params.from ? startOfDay(new Date(params.from)) : undefined,
        lte: params.to ? endOfDay(new Date(params.to)) : undefined,
      },
    });
  }
  if (params.q) {
    const q = params.q.trim();
    AND.push({
      OR: [
        { visitCode: { contains: q } },
        { purpose: { contains: q } },
        { qrToken: { contains: q } },
        { host: { name: { contains: q } } },
        { department: { name: { contains: q } } },
        { visitors: { some: { visitor: { fullName: { contains: q } } } } },
        { visitors: { some: { visitor: { mobile: { contains: q } } } } },
        { visitors: { some: { visitor: { company: { contains: q } } } } },
      ],
    });
  }

  return prisma.visit.findMany({
    where: { AND },
    include: visitInclude,
    orderBy: [{ visitDate: "desc" }, { expectedArrival: "asc" }],
    take: params.take ?? 80,
  });
}

export async function dashboardStats(user: SessionUser, now = new Date()) {
  const scope = visitWhereFor(user);
  const today = { gte: startOfDay(now), lte: endOfDay(now) };
  const base = (where: Prisma.VisitWhereInput) => prisma.visit.count({ where: { AND: [scope, where] } });

  const [
    visitorsToday,
    currentlyInside,
    expectedToday,
    waitingAtGate,
    pendingApproval,
    checkedOutToday,
    walkInToday,
    vipToday,
    cancelledToday,
    rejectedToday,
    noShows,
    overdue,
  ] = await Promise.all([
    base({ visitDate: today }),
    base({ status: { in: ["CHECKED_IN", "CURRENTLY_INSIDE", "IN_MEETING", "OVERDUE"] } }),
    base({ visitDate: today, status: { in: ["APPROVED", "INVITATION_SENT", "EXPECTED"] } }),
    base({ status: { in: ["WAITING_AT_GATE", "ARRIVED"] } }),
    base({ status: "PENDING_APPROVAL" }),
    base({ checkOutAt: today }),
    base({ type: "WALK_IN", visitDate: today }),
    base({ OR: [{ vip: true }, { type: "VIP" }], visitDate: today }),
    base({ status: "CANCELLED", visitDate: today }),
    base({ status: "REJECTED", visitDate: today }),
    base({ status: "NO_SHOW" }),
    base({ status: "OVERDUE" }),
  ]);

  return {
    visitorsToday,
    currentlyInside,
    expectedToday,
    waitingAtGate,
    pendingApproval,
    checkedOutToday,
    walkInToday,
    vipToday,
    cancelledToday,
    rejectedToday,
    noShows,
    overdue,
  };
}

export async function analytics(user: SessionUser) {
  const scope = visitWhereFor(user);
  const visits = await prisma.visit.findMany({
    where: scope,
    include: {
      department: true,
      visitors: { include: { visitor: true }, where: { isPrimary: true } },
    },
  });

  const byDepartment: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byCompany: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byHour: Record<string, number> = {};
  let walkIn = 0;
  let planned = 0;
  let approved = 0;
  let rejected = 0;
  let durationTotal = 0;
  let durationCount = 0;

  for (const visit of visits) {
    byDepartment[visit.department.name] = (byDepartment[visit.department.name] ?? 0) + 1;
    byType[visit.type] = (byType[visit.type] ?? 0) + 1;
    const company = visit.visitors[0]?.visitor.company || "Unspecified";
    byCompany[company] = (byCompany[company] ?? 0) + 1;
    const day = visit.visitDate.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
    const month = visit.visitDate.toISOString().slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + 1;
    const hour = String(visit.expectedArrival.getHours()).padStart(2, "0") + ":00";
    byHour[hour] = (byHour[hour] ?? 0) + 1;
    if (visit.type === "WALK_IN") walkIn += 1;
    else planned += 1;
    if (visit.status === "REJECTED") rejected += 1;
    if (["APPROVED", "INVITATION_SENT", "EXPECTED", "CHECKED_IN", "CURRENTLY_INSIDE", "IN_MEETING", "OVERDUE", "CHECKED_OUT", "COMPLETED"].includes(visit.status)) {
      approved += 1;
    }
    if (visit.durationMinutes) {
      durationTotal += visit.durationMinutes;
      durationCount += 1;
    }
  }

  const frequent = await prisma.visitor.findMany({
    include: { _count: { select: { visitLinks: true } } },
    orderBy: { visitLinks: { _count: "desc" } },
    take: 8,
  });

  return {
    byDepartment,
    byType,
    byCompany,
    byDay,
    byMonth,
    byHour,
    walkIn,
    planned,
    approved,
    rejected,
    avgDuration: durationCount ? Math.round(durationTotal / durationCount) : 0,
    frequent,
    mostVisited: Object.entries(byDepartment).sort((a, b) => b[1] - a[1]).slice(0, 6),
  };
}

export async function lookups() {
  const { ensurePayrollSynced } = await import("./payroll");
  await ensurePayrollSynced();
  const [departments, hosts, rooms, settings, catalog] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: {
        isActive: true,
        payrollNo: { not: null },
        role: { notIn: ["SECURITY_GUARD"] },
        NOT: { email: "olga@neweast.co" },
      },
      include: { department: true },
      orderBy: { name: "asc" },
    }),
    prisma.lookup.findMany({ where: { active: true }, orderBy: { label: "asc" } }),
    prisma.systemSetting.findMany(),
    listActiveServices(),
  ]);
  return { departments, hosts, rooms, settings, catalog };
}

export function recentDays(n = 14) {
  const start = startOfDay(subDays(new Date(), n - 1));
  return { start, end: endOfDay(new Date()) };
}
