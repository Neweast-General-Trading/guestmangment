import { markAllReadAction, markReadAction } from "@/app/actions";
import { Button, PageHeader } from "@/components/ui";
import { NoticeList } from "@/components/paged-tables";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const session = await requireSession();
  if (!session) return null;
  const items = await prisma.notification.findMany({
    where: { userId: session.id },
    include: { visit: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Visit created, approvals, arrivals, overdue visitors, and check-out events."
        actions={
          <form action={markAllReadAction}>
            <Button type="submit" variant="secondary">
              Mark all read
            </Button>
          </form>
        }
      />
      <NoticeList items={items} onRead={markReadAction} />
    </div>
  );
}
