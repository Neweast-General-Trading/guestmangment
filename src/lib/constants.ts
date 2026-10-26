export const ROLES = [
  "EMPLOYEE",
  "DEPARTMENT_MANAGER",
  "HR_ADMIN",
  "SECURITY_GUARD",
  "SECURITY_SUPERVISOR",
  "MANAGEMENT",
  "SYSTEM_ADMIN",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Employee",
  DEPARTMENT_MANAGER: "Manager",
  HR_ADMIN: "Reception",
  SECURITY_GUARD: "Guard",
  SECURITY_SUPERVISOR: "Guard",
  MANAGEMENT: "Reporting and control",
  SYSTEM_ADMIN: "Administration",
};

export const VISIT_TYPES = [
  "EMPLOYEE_VISIT",
  "CUSTOMER",
  "SUPPLIER",
  "WALK_IN",
  "VIP",
  "CANDIDATE",
  "GROUP",
  "GENERAL",
  "GUEST",
] as const;

export type VisitType = (typeof VISIT_TYPES)[number];

export const FORM_VISIT_TYPES = ["CUSTOMER", "EMPLOYEE_VISIT"] as const;

export const VISIT_TYPE_LABEL: Record<VisitType, string> = {
  EMPLOYEE_VISIT: "Employee Visit",
  CUSTOMER: "Customer Visit",
  SUPPLIER: "Supplier / Vendor",
  WALK_IN: "Walk-in",
  VIP: "VIP / Executive",
  CANDIDATE: "Candidate / Interview",
  GROUP: "Group visit",
  GENERAL: "General / Exploration",
  GUEST: "Guest",
};

export const VISIT_STATUSES = [
  "DRAFT",
  "INTAKE",
  "MANAGER_REVIEW",
  "ESCALATED",
  "PENDING_APPROVAL",
  "APPROVED",
  "INVITATION_SENT",
  "EXPECTED",
  "ARRIVED",
  "WAITING_AT_GATE",
  "SECURITY_VERIFICATION",
  "CHECKED_IN",
  "CURRENTLY_INSIDE",
  "IN_MEETING",
  "OVERDUE",
  "CHECKED_OUT",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "NO_SHOW",
  "EXPIRED",
  "ACCESS_DENIED",
] as const;

export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const STATUS_LABEL: Record<VisitStatus, string> = {
  DRAFT: "Draft",
  INTAKE: "Intake",
  MANAGER_REVIEW: "With line manager",
  ESCALATED: "Escalated",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  INVITATION_SENT: "Invitation sent",
  EXPECTED: "Expected",
  ARRIVED: "Arrived",
  WAITING_AT_GATE: "Waiting at gate",
  SECURITY_VERIFICATION: "Security verification",
  CHECKED_IN: "Checked-in",
  CURRENTLY_INSIDE: "Inside",
  IN_MEETING: "In meeting",
  OVERDUE: "Overdue",
  CHECKED_OUT: "Checked-out",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
  EXPIRED: "Expired",
  ACCESS_DENIED: "Access denied",
};

export const VISITOR_CATEGORIES = [
  { code: "CUSTOMER", label: "Customer" },
  { code: "SUPPLIER", label: "Supplier" },
  { code: "CONTRACTOR", label: "Contractor" },
  { code: "PARTNER", label: "Business partner" },
  { code: "CONSULTANT", label: "Consultant" },
  { code: "AUDITOR", label: "Auditor" },
  { code: "CANDIDATE", label: "Candidate" },
  { code: "GOVERNMENT", label: "Government" },
  { code: "VIP", label: "VIP / Executive" },
  { code: "GUEST", label: "Guest" },
] as const;

export const ID_TYPES = [
  { code: "NATIONAL_ID", label: "National ID" },
  { code: "PASSPORT", label: "Passport" },
  { code: "RESIDENCY", label: "Residency permit" },
  { code: "DRIVER_LICENSE", label: "Driver license" },
  { code: "NONE", label: "Not required" },
] as const;

export const GATES = ["Main Gate", "Staff Entrance", "Loading Bay", "Executive Entrance"] as const;

export const LOCATIONS = [
  "Lobby / Reception",
  "Executive Floor",
  "Sales Floor",
  "Operations Wing",
  "HR Suite",
  "Finance Floor",
  "IT Center",
  "Procurement",
  "Legal",
  "Training Room",
  "Cafeteria Meeting Area",
] as const;

export const MEETING_ROOMS = [
  "Boardroom A",
  "Boardroom B",
  "Meeting Room 1",
  "Meeting Room 2",
  "Meeting Room 3",
  "Innovation Lab",
  "Interview Room 1",
  "Interview Room 2",
  "Training Hall",
] as const;

export const ACCESS_AREAS = [
  "Public / Lobby",
  "General Offices",
  "Restricted Operations",
  "Executive Suite",
  "Data Center (escorted)",
  "Warehouse",
] as const;

export const INSIDE_STATUSES: VisitStatus[] = [
  "CHECKED_IN",
  "CURRENTLY_INSIDE",
  "IN_MEETING",
  "OVERDUE",
];

export const OPEN_STATUSES: VisitStatus[] = [
  "DRAFT",
  "INTAKE",
  "MANAGER_REVIEW",
  "ESCALATED",
  "PENDING_APPROVAL",
  "APPROVED",
  "INVITATION_SENT",
  "EXPECTED",
  "ARRIVED",
  "WAITING_AT_GATE",
  "SECURITY_VERIFICATION",
  "CHECKED_IN",
  "CURRENTLY_INSIDE",
  "IN_MEETING",
  "OVERDUE",
];

export const TERMINAL_STATUSES: VisitStatus[] = [
  "CHECKED_OUT",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "NO_SHOW",
  "EXPIRED",
  "ACCESS_DENIED",
];

export const GUEST_KINDS = [
  { code: "VIP", label: "VIP" },
  { code: "SUPPLIER", label: "Supplier" },
  { code: "CUSTOMER", label: "Customer" },
  { code: "GUEST", label: "Guest" },
] as const;

export type GuestKind = (typeof GUEST_KINDS)[number]["code"];

export const GUEST_KIND_LABEL: Record<GuestKind, string> = {
  VIP: "VIP",
  SUPPLIER: "Supplier",
  CUSTOMER: "Customer",
  GUEST: "Guest",
};

export const HQ_NAME = "NEWEAST Headquarters";
export const APP_NAME = "Guest Management";
export const DEFAULT_PASSWORD = "neweast123";

export const APPROVER_PRESETS = [
  { code: "HOST_MANAGER", label: "Line Manager", role: "DEPARTMENT_MANAGER" },
  { code: "HOST", label: "Host employee", role: "EMPLOYEE" },
  { code: "MAIS", label: "Mais Alhamwi", role: "HR_ADMIN", email: "mais.alhamwi@neweast.com" },
  { code: "SAMIR", label: "Samir Ibrahim", role: "MANAGEMENT", email: "samir.ibrahim@neweast.co" },
  { code: "JESMAN", label: "Jesman Muruganantham", role: "DEPARTMENT_MANAGER", email: "jesman@neweast.co" },
  { code: "SAKOUR", label: "Jad Sakour", role: "SYSTEM_ADMIN", email: "sakour@neweast.co" },
] as const;

export type ApproverPreset = (typeof APPROVER_PRESETS)[number]["code"];
