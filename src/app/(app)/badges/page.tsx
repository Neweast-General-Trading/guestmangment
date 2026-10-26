import { PageHeader } from "@/components/ui";
import { BadgeTable } from "@/components/paged-tables";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BadgesPage() {
  await requireSession();
  const badges = await prisma.badge.findMany({
    include: {
      visit: { include: { host: true, department: true, visitors: { include: { visitor: true } } } },
    },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader title="Visitor badges" description="Issued badges must be returned or closed at check-out." />
      <BadgeTable badges={badges} />
    </div>
  );
}
