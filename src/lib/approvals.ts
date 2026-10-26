import { prisma } from "./prisma";
import { addTimeline, writeAudit } from "./audit";
import { notify, notifyRole } from "./notify";
import {
  approvalRequestCopy,
  hostApprovalProgressCopy,
  hostApprovalSentCopy,
  visitApprovedCopy,
  visitorNameOf,
} from "./notice-copy";
import { canDecideApproval, type SessionUser } from "./permissions";
import { openServiceTasks } from "./service-master";
import { APPROVER_PRESETS, type VisitType } from "./constants";
import { findUserByEmail, findUserByName } from "./payroll";

export type ApprovalStep = { name: string; role: string; preset?: string };
export { approvalDesk, approvalState, STEP_STATUS_LABEL } from "./approval-state";

export const DEFAULT_RULES: {
  visitType: VisitType;
  vip?: boolean;
  steps: ApprovalStep[];
}[] = [
  {
    visitType: "CUSTOMER",
    steps: [
      { name: "Line Manager", role: "DEPARTMENT_MANAGER", preset: "HOST_MANAGER" },
      { name: "Samir Ibrahim", role: "MANAGEMENT", preset: "SAMIR" },
    ],
  },
  {
    visitType: "EMPLOYEE_VISIT",
    steps: [{ name: "Mais Alhamwi", role: "HR_ADMIN", preset: "MAIS" }],
  },
];

function ruleType(type: string) {
  if (type === "EMPLOYEE_VISIT" || type === "CANDIDATE") return "EMPLOYEE_VISIT";
  return "CUSTOMER";
}

export async function ensureDefaultApprovalRules() {
  const stamp = await prisma.systemSetting.findUnique({ where: { key: "approval_rules_v3" } });
  if (stamp?.value === "1") return;
  await prisma.approvalRule.deleteMany();
  await prisma.approvalRule.createMany({
    data: DEFAULT_RULES.map((rule) => ({
      visitType: rule.visitType,
      stepsJson: JSON.stringify(rule.steps),
      isActive: true,
    })),
  });
  await prisma.systemSetting.upsert({
    where: { key: "approval_rules_v3" },
    update: { value: "1" },
    create: { key: "approval_rules_v3", value: "1" },
  });
}

export function stepsFromPresetCodes(codes: string[]): ApprovalStep[] {
  return codes
    .map((code) => APPROVER_PRESETS.find((item) => item.code === code))
    .filter((item): item is (typeof APPROVER_PRESETS)[number] => Boolean(item))
    .map((item) => ({ name: item.label, role: item.role, preset: item.code }));
}

function inferPreset(step: ApprovalStep) {
  if (step.preset) return step.preset;
  const byName = APPROVER_PRESETS.find((item) => item.label === step.name);
  if (byName) return byName.code;
  if (step.role === "DEPARTMENT_MANAGER") return "HOST_MANAGER";
  if (step.role === "EMPLOYEE") return "HOST";
  if (step.role === "HR_ADMIN") return "MAIS";
  if (step.role === "MANAGEMENT") return "SAMIR";
  return "";
}

async function resolveAssignee(
  step: ApprovalStep,
  visit: {
    hostId: string;
    host: { name: string; managerName: string | null };
    department: { managerId: string | null };
  },
) {
  const preset = inferPreset(step);
  if (preset === "HOST") return { id: visit.hostId, name: visit.host.name };
  if (preset === "HOST_MANAGER") {
    const named = await findUserByName(visit.host.managerName);
    if (named) {
      const user = await prisma.user.findUnique({ where: { id: named.id }, select: { id: true, name: true } });
      if (user) return user;
    }
    if (visit.department.managerId) {
      const manager = await prisma.user.findUnique({
        where: { id: visit.department.managerId },
        select: { id: true, name: true },
      });
      if (manager) return manager;
    }
    return { id: null as string | null, name: visit.host.managerName || step.name };
  }
  const def = APPROVER_PRESETS.find((item) => item.code === preset);
  if (def && "email" in def && def.email) {
    const user = (await findUserByEmail(def.email)) ?? (await findUserByName(def.label));
    return { id: user?.id ?? null, name: def.label };
  }
  return { id: null as string | null, name: step.name };
}

async function notifyNamed(input: {
  userId: string | null;
  fallbackId: string;
  visitId: string;
  type: string;
  title: string;
  message: string;
  onBehalfOf: string;
}) {
  await notify({
    userId: input.userId || input.fallbackId,
    visitId: input.visitId,
    type: input.type,
    title: input.title,
    message: input.message,
    onBehalfOf: input.onBehalfOf,
  });
}

export async function resolveRule(input: {
  type: string;
  departmentCode?: string | null;
  visitorCategory?: string | null;
  vip?: boolean;
}): Promise<ApprovalStep[]> {
  await ensureDefaultApprovalRules();
  const type = ruleType(input.type);
  const rules = await prisma.approvalRule.findMany({
    where: { isActive: true, visitType: type },
  });

  const scored = rules
    .map((rule) => {
      let score = 1;
      if (rule.vip && !input.vip) return { rule, score: -1 };
      if (rule.vip && input.vip) score += 4;
      if (rule.departmentCode && rule.departmentCode !== input.departmentCode) return { rule, score: -1 };
      if (rule.departmentCode) score += 3;
      if (rule.visitorCategory && rule.visitorCategory !== input.visitorCategory) return { rule, score: -1 };
      if (rule.visitorCategory) score += 2;
      return { rule, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored[0]) return JSON.parse(scored[0].rule.stepsJson) as ApprovalStep[];

  return DEFAULT_RULES.find((rule) => rule.visitType === type)?.steps ?? DEFAULT_RULES[0].steps;
}

export async function startApprovals(visitId: string, actorId: string) {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: {
      department: true,
      host: true,
      visitors: { include: { visitor: true }, orderBy: { isPrimary: "desc" } },
    },
  });

  const steps = await resolveRule({
    type: visit.type,
    departmentCode: visit.department.code,
    visitorCategory: visit.visitors[0]?.visitor.visitorType,
    vip: visit.vip,
  });

  const resolved = await Promise.all(steps.map((step) => resolveAssignee(step, visit)));

  await prisma.approval.deleteMany({ where: { visitId } });
  await prisma.approval.createMany({
    data: steps.map((step, index) => ({
      visitId,
      stepOrder: index + 1,
      stepName: resolved[index].name,
      requiredRole: step.role,
      assigneeId: resolved[index].id,
      status: index === 0 ? "PENDING" : "WAITING",
    })),
  });

  const firstWho = resolved[0];
  const guest = visitorNameOf(visit.visitors);
  const asked = approvalRequestCopy({
    approverName: firstWho.name,
    visitorName: guest,
    visitCode: visit.visitCode,
    purpose: visit.purpose,
    hostName: visit.host.name,
  });
  await notifyNamed({
    userId: firstWho.id,
    fallbackId: visit.hostId,
    visitId,
    type: "APPROVAL_REQUIRED",
    title: asked.title,
    message: asked.message,
    onBehalfOf: firstWho.name,
  });
  if (visit.hostId !== firstWho.id) {
    const hostCopy = hostApprovalSentCopy({
      hostName: visit.host.name,
      visitorName: guest,
      approverName: firstWho.name,
      visitCode: visit.visitCode,
    });
    await notify({
      userId: visit.hostId,
      visitId,
      type: "APPROVAL_SENT",
      title: hostCopy.title,
      message: hostCopy.message,
      onBehalfOf: visit.host.name,
    });
  }

  await addTimeline({
    visitId,
    event: "Approval requested",
    note: resolved.map((step) => step.name).join(" → "),
    userId: actorId,
  });
  await writeAudit({
    userId: actorId,
    visitId,
    action: "Approval requested",
    module: "Approvals",
    newValue: steps,
  });
}

export async function decideApproval(input: {
  visitId: string;
  actor: SessionUser;
  decision: "APPROVED" | "REJECTED" | "INFO_REQUESTED";
  comments?: string;
}) {
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: input.visitId },
    include: {
      approvals: { orderBy: { stepOrder: "asc" } },
      host: true,
      createdBy: true,
      visitors: { include: { visitor: true }, orderBy: { isPrimary: "desc" } },
    },
  });
  const guest = visitorNameOf(visit.visitors);

  if (input.actor.role === "SECURITY_GUARD" && visit.createdById === input.actor.id) {
    throw new Error("Security cannot approve a visit they registered unless policy allows it.");
  }

  const current = visit.approvals.find((step) => step.status === "PENDING");
  if (!current) throw new Error("No pending approval step.");
  if (
    !canDecideApproval(input.actor.role, current.requiredRole, {
      actorId: input.actor.id,
      assigneeId: current.assigneeId,
      hostId: visit.hostId,
      createdById: visit.createdById,
    })
  ) {
    throw new Error("You are not assigned to this approval step.");
  }

  await prisma.approval.update({
    where: { id: current.id },
    data: {
      status: input.decision,
      comments: input.comments || null,
      decidedAt: new Date(),
    },
  });

  if (input.decision === "INFO_REQUESTED") {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { status: "PENDING_APPROVAL" },
    });
    await notify({
      userId: visit.createdById,
      visitId: visit.id,
      type: "INFO_REQUESTED",
      title: "Additional information requested",
      message: `Hello ${visit.createdBy.name},\n${input.comments || `${visit.visitCode} needs more information before approval.`}`,
      onBehalfOf: input.actor.name,
    });
    if (visit.createdById !== visit.hostId) {
      await notify({
        userId: visit.hostId,
        visitId: visit.id,
        type: "INFO_REQUESTED",
        title: "Additional information requested",
        message: `Hello ${visit.host.name},\n${input.comments || `${visit.visitCode} needs more information before approval.`}`,
        onBehalfOf: input.actor.name,
      });
    }
    await addTimeline({
      visitId: visit.id,
      event: "Additional information requested",
      note: input.comments,
      userId: input.actor.id,
    });
    return { status: "PENDING_APPROVAL" };
  }

  if (input.decision === "REJECTED") {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { status: "REJECTED" },
    });
    await notify({
      userId: visit.createdById,
      visitId: visit.id,
      type: "VISIT_REJECTED",
      title: "Visit rejected",
      message: `Hello ${visit.createdBy.name},\n${input.comments || `${guest}'s visit ${visit.visitCode} was rejected.`}`,
      onBehalfOf: input.actor.name,
    });
    if (visit.createdById !== visit.hostId) {
      await notify({
        userId: visit.hostId,
        visitId: visit.id,
        type: "VISIT_REJECTED",
        title: "Visit rejected",
        message: `Hello ${visit.host.name},\n${input.comments || `${guest}'s visit ${visit.visitCode} was rejected.`}`,
        onBehalfOf: input.actor.name,
      });
    }
    await addTimeline({
      visitId: visit.id,
      event: "Rejected",
      note: input.comments,
      userId: input.actor.id,
    });
    await writeAudit({
      userId: input.actor.id,
      visitId: visit.id,
      action: "Rejected",
      module: "Approvals",
      previousValue: visit.status,
      newValue: "REJECTED",
    });
    return { status: "REJECTED" };
  }

  const next = visit.approvals.find((step) => step.stepOrder === current.stepOrder + 1);
  if (next) {
    await prisma.approval.update({
      where: { id: next.id },
      data: { status: "PENDING" },
    });
    const nextAsk = approvalRequestCopy({
      approverName: next.stepName,
      visitorName: guest,
      visitCode: visit.visitCode,
      purpose: visit.purpose,
      hostName: visit.host.name,
    });
    await notifyNamed({
      userId: next.assigneeId,
      fallbackId: visit.hostId,
      visitId: visit.id,
      type: "APPROVAL_REQUIRED",
      title: nextAsk.title,
      message: nextAsk.message,
      onBehalfOf: next.stepName,
    });
    if (visit.hostId !== next.assigneeId) {
      const progress = hostApprovalProgressCopy({
        hostName: visit.host.name,
        visitorName: guest,
        visitCode: visit.visitCode,
        approvedBy: current.stepName,
        nextName: next.stepName,
      });
      await notify({
        userId: visit.hostId,
        visitId: visit.id,
        type: "APPROVAL_PROGRESS",
        title: progress.title,
        message: progress.message,
        onBehalfOf: visit.host.name,
      });
    }
    await addTimeline({
      visitId: visit.id,
      event: "Approved",
      note: `${current.stepName} approved. Next: ${next.stepName}.`,
      userId: input.actor.id,
    });
    return { status: "PENDING_APPROVAL" };
  }

  const nextStatus = "APPROVED";
  await prisma.visit.update({
    where: { id: visit.id },
    data: { status: nextStatus },
  });
  const approvedForCreator = visitApprovedCopy({
    toName: visit.createdBy.name,
    visitorName: guest,
    visitCode: visit.visitCode,
  });
  await notify({
    userId: visit.createdById,
    visitId: visit.id,
    type: "VISIT_APPROVED",
    title: approvedForCreator.title,
    message: approvedForCreator.message,
    onBehalfOf: input.actor.name,
  });
  if (visit.createdById !== visit.hostId) {
    const approvedForHost = visitApprovedCopy({
      toName: visit.host.name,
      visitorName: guest,
      visitCode: visit.visitCode,
    });
    await notify({
      userId: visit.hostId,
      visitId: visit.id,
      type: "VISIT_APPROVED",
      title: approvedForHost.title,
      message: approvedForHost.message,
      onBehalfOf: input.actor.name,
    });
  }
  await notifyRole("SECURITY_GUARD", {
    visitId: visit.id,
    type: "VISIT_APPROVED",
    title: "Approved visit ready",
    message: `${visit.visitCode} is approved and may be processed at the gate.`,
    onBehalfOf: "Security",
  });
  await addTimeline({
    visitId: visit.id,
    event: "Approved",
    note: input.comments || "All approval steps completed.",
    userId: input.actor.id,
  });
  await writeAudit({
    userId: input.actor.id,
    visitId: visit.id,
    action: "Approved",
    module: "Approvals",
    previousValue: visit.status,
    newValue: nextStatus,
  });
  try {
    await openServiceTasks(visit.id);
  } catch {
    // Service emails must not roll back approval.
  }
  return { status: nextStatus };
}
