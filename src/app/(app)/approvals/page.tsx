import { decideAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { ApprovalsList } from "@/components/paged-tables";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDecideApproval } from "@/lib/permissions";

export default async function ApprovalsPage() {
  const session = await requireSession();
  if (!session) return null;
  const pending = await prisma.approval.findMany({
    where: { status: "PENDING" },
    include: {
      visit: { include: { host: true, department: true, visitors: { include: { visitor: true } }, approvals: { include: { assignee: { include: { department: true } } } } } },
      assignee: { include: { department: true } },
    },
    orderBy: { stepOrder: "asc" },
  });
  const mine = pending.filter((item) =>
    canDecideApproval(session.role, item.requiredRole, {
      actorId: session.id,
      assigneeId: item.assigneeId,
      hostId: item.visit.hostId,
      createdById: item.visit.createdById,
    }),
  );

  return (
    <div>
      <PageHeader title="Approvals" description="Decide visit requests assigned to your role." />
      <ApprovalsList items={mine} onDecide={decideAction} />
    </div>
  );
}
