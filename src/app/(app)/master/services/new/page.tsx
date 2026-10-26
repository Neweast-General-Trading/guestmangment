import { redirect } from "next/navigation";
import { ServiceMasterForm } from "@/components/service-master-form";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { canManageServiceMaster } from "@/lib/permissions";
import { listAssignableStaff } from "@/lib/service-master";

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageServiceMaster(session.role)) redirect("/dashboard");
  const { error } = await searchParams;
  const users = await listAssignableStaff();
  return (
    <div>
      <PageHeader title="Add service" description="Name the service, describe it, and assign the people who will prepare it." />
      {error ? <p className="mb-3 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px]">{error}</p> : null}
      <ServiceMasterForm users={users} />
    </div>
  );
}
