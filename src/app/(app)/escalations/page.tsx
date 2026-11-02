import Link from "next/link";
import { redirect } from "next/navigation";
import { decideBuildingTourAction } from "@/app/actions";
import { FormBusy } from "@/components/form-busy";
import { VisitStatus, TypeTag } from "@/components/status";
import { Card, PageHeader, Textarea } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, TOUR_TYPE_LABEL, parseTourType, type GuestKind, type TourType } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { canDecideBuildingTour, canSeeEscalations } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { visitInclude } from "@/lib/visits";

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; rejected?: string; approved?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canSeeEscalations(session.role, session.email) && !canDecideBuildingTour(session)) redirect("/dashboard");
  const { error, rejected, approved } = await searchParams;
  const visits = await prisma.visit.findMany({
    where: { tourType: "BUILDING", tourStatus: "PENDING" },
    include: visitInclude,
    orderBy: { updatedAt: "desc" },
  });
  const canDecide = canDecideBuildingTour(session);

  return (
    <div>
      <PageHeader
        title="Building tours"
        description="Building Tour requests wait here for Salma Moufallah. A supplier visit and a ground-floor tour are notices only. They do not wait here."
      />
      {error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {error}
        </p>
      ) : null}
      {rejected ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px]">
          Building tour rejected.
        </p>
      ) : null}
      {approved ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          Building tour approved. The booking is confirmed and participants are emailed.
        </p>
      ) : null}

      {visits.length === 0 ? (
        <Card>
          <p className="text-sm font-medium">No building tours waiting.</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">A Building Tour on a customer visit appears here for Salma.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {visits.map((visit) => {
            const kind = (visit.guestKind || "CUSTOMER") as GuestKind;
            const guest = visit.visitors[0]?.visitor;
            const tour = parseTourType(visit.tourType);
            return (
              <Card key={visit.id} padded={false}>
                <div className="border-b border-[var(--line)] px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/intake/${visit.id}`} className="text-[15px] font-medium">
                        {(visit.visitTitle || visit.purpose || "Guest visit").trim()} - {visit.createdBy.name}
                      </Link>
                      <div className="mt-1 text-[13px] text-[var(--muted)]">{visit.meetingRoom || "Room not set"}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <TypeTag type={kind}>{GUEST_KIND_LABEL[kind]}</TypeTag>
                      <VisitStatus visit={visit} />
                    </div>
                  </div>
                  <div className="mt-3 text-right text-[11px] text-[var(--faint)]">{visit.visitCode}</div>
                </div>
                <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
                  <Fact label="Guest" value={guest?.fullName} extra={`${visit.visitorCount} people`} />
                  <Fact label="Department" value={visit.department.name} extra={visit.host.name} />
                  <Fact label="Tour" value={TOUR_TYPE_LABEL[tour as TourType]} extra={visit.meetingRoom || "Room later"} />
                </div>
                {visit.visitors.length ? (
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
                {canDecide ? (
                  <form action={decideBuildingTourAction} className="space-y-2 border-t border-[var(--line)] px-5 py-4">
                    <FormBusy label="Sending decision…" />
                    <input type="hidden" name="visitId" value={visit.id} />
                    <Textarea name="notes" placeholder="Notes (optional)" />
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
                    Waiting for Salma Moufallah.
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
