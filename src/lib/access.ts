import { GATE_PASS_OWNER_EMAIL } from "./arrangement-types";
import { ROLE_LABEL, ROLES, type Role } from "./constants";
import { prisma } from "./prisma";

export const ACCESS_ADMIN_EMAIL = "sakour@neweast.co";

const FULL_ACCESS_EMAILS = new Set([
  ACCESS_ADMIN_EMAIL,
  "guru@neweast.co",
  "guru@neweast.com",
]);

const ROOMS_VIEW_EMAILS = new Set(["maria@neweast.com", "carina@neweast.co", "hannah@neweast.co"]);
const ROOM_BOOKING_EMAILS = new Set([
  "sachini@neweast.com",
  "sachini@neweast.co",
  "sachinialwis1993@gmail.com",
]);

export function isFullAccess(email?: string | null) {
  return FULL_ACCESS_EMAILS.has((email || "").trim().toLowerCase());
}

export function isRoomsViewer(email?: string | null) {
  return ROOMS_VIEW_EMAILS.has((email || "").trim().toLowerCase());
}

export function isRoomBooker(email?: string | null) {
  return ROOM_BOOKING_EMAILS.has((email || "").trim().toLowerCase());
}

const TRACKING_EMAILS = new Set([
  ACCESS_ADMIN_EMAIL,
  "salma.moufallah@neweast.com",
  "salma.moufallah@neweast.co",
]);

export function canSeeTracking(email?: string | null) {
  return TRACKING_EMAILS.has(email?.trim().toLowerCase() || "");
}

export const ACCESS_GROUPS = ["ADMINISTRATION", "HR", "IT", "EMPLOYEE"] as const;
export type AccessGroup = (typeof ACCESS_GROUPS)[number];

export const ACCESS_GROUP_LABEL: Record<AccessGroup, string> = {
  ADMINISTRATION: "Administration",
  HR: "HR",
  IT: "IT",
  EMPLOYEE: "Employee",
};

export const ACCESS_GROUP_NATURE: Record<AccessGroup, string> = {
  ADMINISTRATION: "Reception, general administration, and room bookings",
  HR: "HR administration and the gate pass",
  IT: "Super admin",
  EMPLOYEE: "Submit a visit request",
};

export const ROLE_NATURE: Record<Role, string> = {
  EMPLOYEE: "Staff — submit visit requests",
  DEPARTMENT_MANAGER: "Department manager — submit visit requests",
  HR_ADMIN: "Reception — intake and visit desk",
  SYSTEM_ADMIN: "Administration — full operations",
  MANAGEMENT: "Management — request, reports, and control",
  SECURITY_GUARD: "Guard desk",
  SECURITY_SUPERVISOR: "Guard desk",
};

export const ASSIGNABLE_ROLES = ["EMPLOYEE", "DEPARTMENT_MANAGER", "HR_ADMIN", "MANAGEMENT", "SYSTEM_ADMIN"] as const;

export const ACCESS_PAGE_SIZE = 20;
export const ACCESS_PAGE_SIZES = [10, 20, 50, 100] as const;

export function isAccessGroup(value: string | null | undefined): value is AccessGroup {
  return ACCESS_GROUPS.includes(value as AccessGroup);
}

export function accessGroupLabel(value: string | null | undefined) {
  return isAccessGroup(value) ? ACCESS_GROUP_LABEL[value] : "Employee";
}

export function accessDeskLabel(person: { email: string; role: string }) {
  const email = person.email.trim().toLowerCase();
  if (isFullAccess(email)) return "Super admin — full system and Access";
  if (isRoomsViewer(email)) return "Rooms — see bookings and submit requests";
  if (isRoomBooker(email)) return "Room booking, parking, drivers, and reception";
  if (email === GATE_PASS_OWNER_EMAIL) return "Gate pass and visit requests";
  if (person.role === "HR_ADMIN") return "Reception — intake and rooms";
  if (person.role === "SYSTEM_ADMIN") return "Administration — visits, rooms, and reports";
  if (person.role === "SECURITY_GUARD" || person.role === "SECURITY_SUPERVISOR") return "Guard desk";
  return "Employee — submit visit requests";
}

export function canManageAccess(email?: string | null) {
  return isFullAccess(email);
}

export function inferAccessGroup(_input?: { role?: string | null; departmentCode?: string | null }) {
  return "EMPLOYEE" as const;
}

export function canUseRequestDesk(user: { role: string; email: string; accessGroup?: string | null }) {
  if (user.role === "SECURITY_GUARD" || user.role === "SECURITY_SUPERVISOR") return false;
  return true;
}

export function parseAccessGroup(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!isAccessGroup(raw)) throw new Error("Choose a valid access group.");
  return raw;
}

export function parseAssignableRole(value: FormDataEntryValue | string | null | undefined) {
  const role = String(value || "").trim();
  if (!ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
    throw new Error("Choose a valid role.");
  }
  return role as Role;
}

export function isKnownRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}

export function roleNature(role: string) {
  return isKnownRole(role) ? ROLE_NATURE[role] : ROLE_LABEL[role as Role] || role;
}

export function parseAccessPage(value?: string | null) {
  const page = Number(value);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

export function parseAccessPageSize(value?: string | null) {
  const size = Number(value);
  return (ACCESS_PAGE_SIZES as readonly number[]).includes(size) ? size : ACCESS_PAGE_SIZE;
}

export function accessHref(input: { group?: string; q?: string; page?: number; pageSize?: number }) {
  const next = new URLSearchParams();
  if (input.group) next.set("group", input.group);
  if (input.q) next.set("q", input.q);
  if (input.page && input.page > 1) next.set("page", String(input.page));
  if (input.pageSize && input.pageSize !== ACCESS_PAGE_SIZE) next.set("pageSize", String(input.pageSize));
  const query = next.toString();
  return query ? `/access?${query}` : "/access";
}

export function accessListWhere(input: { group?: string; q?: string }) {
  const q = input.q?.trim() || "";
  const group = isAccessGroup(input.group) ? input.group : "ADMINISTRATION";
  return {
    isActive: true,
    accessGroup: group,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { jobTitle: { contains: q } },
            { department: { name: { contains: q } } },
          ],
        }
      : {}),
  };
}

export async function ensureAccessGroups() {
  const users = await prisma.user.findMany({
    where: { isActive: true, OR: [{ accessGroup: null }, { accessGroup: "" }] },
    select: { id: true, role: true, department: { select: { code: true } } },
  });
  let filled = 0;
  for (const user of users) {
    const group = inferAccessGroup({ role: user.role, departmentCode: user.department?.code });
    if (!group) continue;
    await prisma.user.update({ where: { id: user.id }, data: { accessGroup: group } });
    filled += 1;
  }
  return filled;
}
