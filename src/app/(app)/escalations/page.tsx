import Link from "next/link";
import { redirect } from "next/navigation";
import { decideEscalationAction } from "@/app/actions";
import { FormBusy } from "@/components/form-busy";
import { StatusPill, TypeTag } from "@/components/status";
import { Card, PageHeader, Textarea } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { canDecideEscalation, canSeeEscalations } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { visitInclude } from "@/lib/visits";

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; rejected?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canSeeEscalations(session.role) && !canDecideEscalation(session)) redirect("/dashboard");
  const { error, rejected } = await searchParams;
  const visits = await prisma.visit.findMany({
    where: { source: { in: ["EMAIL", "STAFF"] }, status: "ESCALATED" },
    include: visitInclude,
    orderBy: { updatedAt: "desc" },
  });
  const canDecide = canDecideEscalation(session);

  return (
    <div>
      <PageHeader
        title="Escalations"
        description="Customer email requests waiting on Samir Ibrahim."
      />
      {error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {error}
        </p>
      ) : null}
      {rejected ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px]">
          Request rejected.
        </p>
      ) : null}

      {visits.length === 0 ? (
        <Card>
          <p className="text-sm font-medium">No escalations waiting.</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Customer requests appear here after Administration sends them up.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {visits.map((visit) => {
            const kind = (visit.guestKind || "CUSTOMER") as GuestKind;
            const guest = visit.visitors[0]?.visitor;
            return (
              <Card key={visit.id} padded={false}>
                <div className="border-b border-[var(--line)] px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/intake/${visit.id}`} className="text-[15px] font-semibold">
                        {visit.visitCode}
                      </Link>
                      <TypeTag type={kind}>{GUEST_KIND_LABEL[kind]}</TypeTag>
                      <StatusPill status={visit.status} />
                    </div>
                    <span className="text-[12px] text-[var(--muted)]">{fmtDateTime(visit.expectedArrival)}</span>
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--muted)]">{visit.purpose}</p>
                </div>
                <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
                  <Fact label="Guest" value={guest?.fullName} extra={`${visit.visitorCount} people`} />
                  <Fact label="Department" value={visit.department.name} extra={visit.host.name} />
                  <Fact label="Driver" value={visit.driverRequired ? "Required" : "No"} extra={visit.meetingRoom || "Room later"} />
                </div>
                {visit.visitors.length > 1 ? (
                  <ul className="border-t border-[var(--line)] px-5 py-3 text-[13px] text-[var(--muted)]">
                    {visit.visitors.map((link) => (
                      <li key={link.id}>
                        {link.visitor.fullName}
                        {link.visitor.company ? ` · ${link.visitor.company}` : ""}
                        {link.visitor.mobile ? ` · ${link.visitor.mobile}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {visit.escalationNotes ? (
                  <p className="border-t border-[var(--line)] px-5 py-3 text-[13px]">{visit.escalationNotes}</p>
                ) : null}
                {canDecide ? (
                  <form action={decideEscalationAction} className="space-y-2 border-t border-[var(--line)] px-5 py-4">
                    <FormBusy label="Sending decision…" />
                    <input type="hidden" name="visitId" value={visit.id} />
                    <Textarea name="notes" placeholder="Notes for Administration" />
                    <div className="flex gap-2">
                      <button name="decision" value="APPROVED" className="h-8 rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)]">
                        Approve
                      </button>
                      <button name="decision" value="REJECTED" className="h-8 rounded-md border border-[var(--line)] bg-white px-3 text-[12px]">
                        Reject
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="border-t border-[var(--line)] px-5 py-3 text-[12px] text-[var(--muted)]">
                    Waiting for Samir Ibrahim.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value, extra }: { label: string; value?: string | null; extra?: string | null }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">{label}</div>
      <div className="mt-1 text-[13px] font-medium">{value || "—"}</div>
      {extra ? <div className="text-[12px] text-[var(--muted)]">{extra}</div> : null}
    </div>
  );
}
