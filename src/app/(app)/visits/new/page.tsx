import { PageHeader } from "@/components/ui";
import { VisitForm } from "@/components/visit-form";
import { requireSession } from "@/lib/auth";
import { meetingRoomOptions } from "@/lib/graph";
import { lookups } from "@/lib/queries";

export default async function NewVisitPage() {
  const session = await requireSession();
  if (!session) return null;
  const [{ hosts, departments, catalog }, rooms] = await Promise.all([lookups(), meetingRoomOptions()]);

  return (
    <div>
      <PageHeader
        title="Visit request"
        description="Register a planned visitor. Purpose is required and should be specific enough for approval and security."
      />
      <VisitForm hosts={hosts} departments={departments} currentUserId={session.id} catalog={catalog} rooms={rooms} />
    </div>
  );
}
