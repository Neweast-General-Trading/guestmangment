import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ServiceMasterTable } from "@/components/paged-tables";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageServiceMaster } from "@/lib/permissions";
import { upsertServiceCatalog } from "@/lib/service-master";

export default async function ServiceMasterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageServiceMaster(session.role)) redirect("/dashboard");
  const { error } = await searchParams;
  await upsertServiceCatalog();
  const services = await prisma.guestService.findMany({
    include: { owners: { include: { user: true } }, _count: { select: { tasks: true } } },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Service master"
        description="Define guest services and who prepares them. Owners are emailed when a visit is approved."
        actions={
          <Link href="/master/services/new" className="inline-flex h-8 items-center rounded-md bg-[var(--brand)] px-3 text-[12px] font-medium text-white">
            Add service
          </Link>
        }
      />
      {error ? <p className="mb-3 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px]">{error}</p> : null}
      <ServiceMasterTable services={services} />
    </div>
  );
}
