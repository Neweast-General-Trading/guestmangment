import { PageHeader } from "@/components/ui";
import { AuditTable } from "@/components/paged-tables";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageConfig } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function AuditPage() {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageConfig(session.role)) redirect("/dashboard");
  const logs = await prisma.auditLog.findMany({
    include: { user: true, visit: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div>
      <PageHeader title="Audit logs" description="Every important action: who, what, when, previous and new values." />
      <AuditTable logs={logs} />
    </div>
  );
}
