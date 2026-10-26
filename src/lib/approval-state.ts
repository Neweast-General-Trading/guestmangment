const DESK: Record<string, string> = {
  HR_ADMIN: "Administration / HR",
  DEPARTMENT_MANAGER: "Department manager",
  EMPLOYEE: "Host",
  MANAGEMENT: "Management",
  SECURITY_SUPERVISOR: "Security",
  SYSTEM_ADMIN: "System administration",
};

export const STEP_STATUS_LABEL: Record<string, string> = {
  PENDING: "Waiting",
  WAITING: "Queued",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  INFO_REQUESTED: "Needs info",
};

type DeskStep = {
  requiredRole: string;
  status: string;
  stepName: string;
  assignee?: { name: string; department?: { name: string } | null } | null;
};

type DeskVisit = {
  status: string;
  department: { name: string };
  approvals: DeskStep[];
};

export function approvalDesk(step: DeskStep, visit: { department: { name: string } }) {
  if (step.requiredRole === "DEPARTMENT_MANAGER" || step.requiredRole === "EMPLOYEE") {
    return visit.department.name;
  }
  return DESK[step.requiredRole] ?? visit.department.name;
}

export function approvalState(visit: DeskVisit) {
  const steps = visit.approvals ?? [];
  if (visit.status === "DRAFT" || steps.length === 0) {
    return {
      desk: visit.status === "DRAFT" ? "—" : visit.department.name,
      label: visit.status === "DRAFT" ? "Not submitted" : "No approval workflow",
      status: visit.status === "DRAFT" ? "DRAFT" : visit.status,
      current: null as DeskStep | null,
      steps,
    };
  }
  const pending = steps.find((step) => step.status === "PENDING" || step.status === "INFO_REQUESTED");
  if (pending) {
    return { desk: approvalDesk(pending, visit), label: pending.stepName, status: pending.status, current: pending, steps };
  }
  const rejected = steps.find((step) => step.status === "REJECTED");
  if (rejected) {
    return { desk: approvalDesk(rejected, visit), label: rejected.stepName, status: "REJECTED", current: rejected, steps };
  }
  return {
    desk: visit.department.name,
    label: "All steps approved",
    status: "APPROVED",
    current: null as DeskStep | null,
    steps,
  };
}
