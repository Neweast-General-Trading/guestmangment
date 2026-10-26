import { canManageAccess, canSeeTracking, canUseRequestDesk, isFullAccess } from "./access";
import { GATE_PASS_OWNER_EMAIL, GIFT_OWNER_EMAIL } from "./arrangement-types";
import { INSIDE_STATUSES, type Role } from "./constants";

export function canManageServiceMaster(role: Role) {
  return role === "SYSTEM_ADMIN" || role === "HR_ADMIN";
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string | null;
  jobTitle: string | null;
  accessGroup?: string | null;
};

export function canSeeAllVisits(role: Role) {
  return [
    "HR_ADMIN",
    "SYSTEM_ADMIN",
    "MANAGEMENT",
    "SECURITY_GUARD",
    "SECURITY_SUPERVISOR",
  ].includes(role);
}

export function canSeeDepartmentVisits(role: Role) {
  return role === "DEPARTMENT_MANAGER" || canSeeAllVisits(role);
}

export function canApproveAs(role: Role, required: string) {
  if (role === "SYSTEM_ADMIN" || role === "HR_ADMIN") return true;
  if (required === "HR_ADMIN" && role === "MANAGEMENT") return true;
  if (required === "DEPARTMENT_MANAGER" && role === "DEPARTMENT_MANAGER") return true;
  if (required === "EMPLOYEE" && (role === "EMPLOYEE" || role === "DEPARTMENT_MANAGER")) return true;
  return role === required;
}

/** Demo HQ: operations roles can simulate the current approval step. */
export function canDecideApproval(
  role: Role,
  required: string,
  opts?: { actorId?: string; assigneeId?: string | null; hostId?: string; createdById?: string },
) {
  if (["SYSTEM_ADMIN", "HR_ADMIN", "MANAGEMENT", "DEPARTMENT_MANAGER", "SECURITY_SUPERVISOR"].includes(role)) {
    return true;
  }
  if (canApproveAs(role, required)) return true;
  if (opts?.assigneeId && opts.actorId && opts.assigneeId === opts.actorId) return true;
  if (required === "EMPLOYEE" && opts?.hostId && opts.actorId === opts.hostId) return true;
  if (role === "SECURITY_GUARD" && opts?.createdById !== opts?.actorId) return true;
  return false;
}

export function canManageIntake(role: Role) {
  return role === "SYSTEM_ADMIN" || role === "HR_ADMIN";
}

export function isGiftApprover(user: { email: string }) {
  return user.email.trim().toLowerCase() === GIFT_OWNER_EMAIL;
}

export function canSeeGifts(user: { role: Role; email: string }) {
  return canManageIntake(user.role) || isGiftApprover(user);
}

export function canApproveGift(user: { role: Role; email: string }) {
  return isGiftApprover(user) || user.role === "SYSTEM_ADMIN";
}

export function isGatePassApprover(user: { email: string }) {
  return user.email.trim().toLowerCase() === GATE_PASS_OWNER_EMAIL;
}

export function canSeePasses(user: { role: Role; email: string }) {
  return canManageIntake(user.role) || isGatePassApprover(user);
}

export function canApproveGatePass(user: { role: Role; email: string }) {
  return isGatePassApprover(user) || user.role === "SYSTEM_ADMIN";
}

export function canSeeEscalations(role: Role) {
  return role === "MANAGEMENT" || role === "SYSTEM_ADMIN" || role === "HR_ADMIN";
}

export function canDecideEscalation(user: Pick<SessionUser, "role" | "email">) {
  if (user.role === "MANAGEMENT" || user.role === "SYSTEM_ADMIN") return true;
  return user.email.toLowerCase() === "samir.ibrahim@neweast.co";
}

export function canManageConfig(role: Role) {
  return role === "SYSTEM_ADMIN" || role === "HR_ADMIN";
}

export function canSeeIdentity(role: Role) {
  return role === "HR_ADMIN" || role === "SYSTEM_ADMIN" || role === "SECURITY_SUPERVISOR";
}

export function canSeeInternalNotes(role: Role) {
  return !["SECURITY_GUARD"].includes(role);
}

export function canCreateVisit(role: Role) {
  return [
    "EMPLOYEE",
    "DEPARTMENT_MANAGER",
    "HR_ADMIN",
    "SYSTEM_ADMIN",
    "MANAGEMENT",
    "SECURITY_GUARD",
    "SECURITY_SUPERVISOR",
  ].includes(role);
}

export function canOperateGate(role: Role) {
  return ["SECURITY_GUARD", "SECURITY_SUPERVISOR", "SYSTEM_ADMIN"].includes(role);
}

export function canAssignParking(role: Role, opts: { actorId: string; hostId: string }) {
  return canOperateGate(role) || role === "HR_ADMIN" || opts.actorId === opts.hostId;
}

export function canAssignStaffParking(role: Role | string) {
  return role === "SYSTEM_ADMIN";
}

export function isInside(status: string) {
  return INSIDE_STATUSES.includes(status as (typeof INSIDE_STATUSES)[number]);
}

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

export function homeFor(role: Role) {
  if (role === "EMPLOYEE" || role === "DEPARTMENT_MANAGER") return "/request";
  if (role === "SECURITY_GUARD" || role === "SECURITY_SUPERVISOR") return "/security";
  if (role === "MANAGEMENT") return "/reports";
  return "/intake";
}

function accessNav(email?: string): NavItem[] {
  return canManageAccess(email) ? [{ href: "/access", label: "Access" }] : [];
}

function requestNav(user: { role: Role; email?: string; accessGroup?: string | null }): NavItem[] {
  return canUseRequestDesk({
    role: user.role,
    email: user.email || "",
    accessGroup: user.accessGroup,
  })
    ? [{ href: "/request", label: "Visit request" }]
    : [];
}

function fullAccessNav(): NavGroup[] {
  return [
    {
      label: "Reception",
      items: [
        { href: "/request", label: "Visit request" },
        { href: "/intake", label: "Visit requests" },
        { href: "/gifts", label: "Gift requests" },
        { href: "/passes", label: "Gate passes" },
        { href: "/rooms", label: "Meeting rooms" },
        { href: "/screens", label: "Screen setup" },
      ],
    },
    {
      label: "Guard",
      items: [
        { href: "/security", label: "Desk" },
        { href: "/inside", label: "Inside now" },
        { href: "/walk-in", label: "Walk-in" },
      ],
    },
    {
      label: "Reporting and control",
      items: [
        { href: "/reports", label: "Reports" },
        { href: "/visits", label: "Visits" },
        { href: "/escalations", label: "Escalations" },
        { href: "/access", label: "Access" },
        { href: "/assign-parking", label: "Assign parking" },
      ],
    },
    {
      label: "Administration",
      items: [
        { href: "/settings", label: "Settings" },
        { href: "/master/services", label: "Service catalogue" },
        { href: "/services", label: "Service tasks" },
        { href: "/directory", label: "Directory" },
        { href: "/audit", label: "Audit" },
      ],
    },
  ];
}

function trackingNav(email?: string): NavItem[] {
  return canSeeTracking(email) ? [{ href: "/tracking", label: "Tracking analysis" }] : [];
}

function withTrackingNav(groups: NavGroup[], email?: string): NavGroup[] {
  const extra = trackingNav(email);
  if (!extra.length) return groups;
  const hasReports = groups.some((group) => group.label === "Reporting and control");
  return groups.map((group, index) => {
    if (group.items.some((item) => item.href === "/tracking")) return group;
    const here = group.label === "Reporting and control" || (!hasReports && index === 0);
    return here ? { ...group, items: [...extra, ...group.items] } : group;
  });
}

export function navGroupsFor(role: Role, email?: string, accessGroup?: string | null): NavGroup[] {
  if (isFullAccess(email)) return withTrackingNav(fullAccessNav(), email);
  const gifts = canSeeGifts({ role, email: email || "" })
    ? ([{ href: "/gifts", label: "Gift requests" }] as NavItem[])
    : [];
  const passes = canSeePasses({ role, email: email || "" })
    ? ([{ href: "/passes", label: "Gate passes" }] as NavItem[])
    : [];
  const request = requestNav({ role, email, accessGroup });
  const access = accessNav(email);
  if (role === "EMPLOYEE") {
    return withTrackingNav([{ label: "Employees", items: [...request, ...gifts, ...passes, ...access] }], email);
  }
  if (role === "DEPARTMENT_MANAGER") {
    return withTrackingNav([{ label: "Managers", items: [...request, ...gifts, ...passes, ...access] }], email);
  }
  if (role === "HR_ADMIN") {
    return withTrackingNav(
      [
        {
          label: "Reception",
          items: [
            ...request,
            { href: "/intake", label: "Visit requests" },
            ...gifts,
            ...passes,
            { href: "/rooms", label: "Meeting rooms" },
            { href: "/screens", label: "Screen setup" },
            ...access,
          ],
        },
      ],
      email,
    );
  }
  if (role === "SECURITY_GUARD" || role === "SECURITY_SUPERVISOR") {
    return [
      {
        label: "Guard",
        items: [
          { href: "/security", label: "Desk" },
          { href: "/inside", label: "Inside now" },
          { href: "/walk-in", label: "Walk-in" },
        ],
      },
    ];
  }
  if (role === "MANAGEMENT") {
    return withTrackingNav(
      [
        {
          label: "Reporting and control",
          items: [
            ...request,
            { href: "/reports", label: "Reports" },
            { href: "/visits", label: "Visits" },
            { href: "/escalations", label: "Escalations" },
            ...access,
          ],
        },
      ],
      email,
    );
  }
  return withTrackingNav(
    [
      {
        label: "Reception",
        items: [
          ...request,
          { href: "/intake", label: "Visit requests" },
          ...gifts,
          ...passes,
          { href: "/rooms", label: "Meeting rooms" },
          { href: "/screens", label: "Screen setup" },
        ],
      },
      {
        label: "Reporting and control",
        items: [
          { href: "/reports", label: "Reports" },
          { href: "/visits", label: "Visits" },
          { href: "/escalations", label: "Escalations" },
          ...access,
          ...(canAssignStaffParking(role) ? [{ href: "/assign-parking", label: "Assign parking" }] : []),
        ],
      },
    ],
    email,
  );
}

export function navFor(role: Role, email?: string, accessGroup?: string | null) {
  return navGroupsFor(role, email, accessGroup).flatMap((group) => group.items);
}
