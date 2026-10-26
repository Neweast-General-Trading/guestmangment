import { notFound, redirect } from "next/navigation";
import { ServiceMasterForm } from "@/components/service-master-form";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageServiceMaster } from "@/lib/permissions";
import { listAssignableStaff } from "@/lib/service-master";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageServiceMaster(session.role)) redirect("/dashboard");
  const { id } = await params;
  const service = await prisma.guestService.findUnique({ where: { id }, include: { owners: true } });
  if (!service) notFound();
  const users = await listAssignableStaff();
  return (
    <div>
      <PageHeader title={service.label} description={service.description || service.hint} />
      <ServiceMasterForm service={service} users={users} />
    </div>
  );
}
