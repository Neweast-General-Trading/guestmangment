import { redirect } from "next/navigation";
import { ArrangementDesk } from "@/components/arrangement-desk";
import { ArrangementPill } from "@/components/arrangement-status";
import { VisitStatus, TypeTag } from "@/components/status";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { listGiftQueue } from "@/lib/arrangements";
import { preparationNote } from "@/lib/preparation";
import { fmtDateTime } from "@/lib/format";
import { canApproveGift, canManageIntake, canSeeGifts } from "@/lib/permissions";

export default async function GiftRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; approved?: string; received?: string; driver?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canSeeGifts(session)) redirect("/dashboard");
  const query = await searchParams;
  const visits = await listGiftQueue(session);
  const canApprove = canApproveGift(session);
  const canComplete = canManageIntake(session.role);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Gift requests"
        description="Marketing reviews the gift type, then Reception marks it Done when the parcel arrives."
      />
      {query.error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.error}
        </p>
      ) : null}
      {query.approved || query.received || query.driver ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          {query.approved ? "Gift approved. Status is now Preparing." : query.received ? "Gift marked Done at Reception." : "Driver confirmed."}
        </p>
      ) : null}

      {visits.length === 0 ? (
        <Card>
          <p className="text-sm font-medium">No open gift requests.</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">New protocol gifts appear here as soon as a visit request reaches Administration.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {visits.map((visit) => {
            const guest = visit.visitors[0]?.visitor.fullName || "Guest";
            const kind = (visit.guestKind || "GUEST") as GuestKind;
            return (
              <Card key={visit.id} padded={false}>
                <div className="border-b border-[var(--line)] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium">{(visit.visitTitle || visit.purpose || "Guest visit").trim()} - {visit.createdBy.name}</div>
                      <div className="mt-1 text-[13px] text-[var(--muted)]">
                        {[visit.meetingRoom || "Room not set", preparationNote(visit)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <TypeTag>{GUEST_KIND_LABEL[kind]}</TypeTag>
                      <VisitStatus visit={visit} />
                      <ArrangementPill status={visit.giftStatus} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-[13px] text-[var(--muted)]">
                      {guest} · {visit.department.name}
                      {visit.host?.name ? ` · Host ${visit.host.name}` : ""} · {fmtDateTime(visit.expectedArrival)}
                    </p>
                    <div className="shrink-0 text-[11px] text-[var(--faint)]">{visit.visitCode}</div>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <ArrangementDesk
                    visit={visit}
                    canComplete={canComplete}
                    canApprove={canApprove}
                    from="gifts"
                    showDriver={false}
                    showPass={false}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
