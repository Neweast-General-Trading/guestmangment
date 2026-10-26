import { restrictVisitorAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { DirectoryList } from "@/components/paged-tables";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageConfig } from "@/lib/permissions";

export default async function DirectoryPage() {
  const session = await requireSession();
  if (!session) return null;
  const visitors = await prisma.visitor.findMany({
    include: {
      visitLinks: {
        include: { visit: { select: { id: true, visitCode: true, visitDate: true, status: true } } },
        orderBy: { visit: { visitDate: "desc" } },
      },
    },
    orderBy: { fullName: "asc" },
    take: 400,
  });

  return (
    <div>
      <PageHeader title="Visitor directory" description="Previous visitors, frequency, and restricted-access flags." />
      <DirectoryList visitors={visitors} canRestrict={canManageConfig(session.role)} onRestrict={restrictVisitorAction} />
    </div>
  );
}
