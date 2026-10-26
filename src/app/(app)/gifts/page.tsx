import { redirect } from "next/navigation";
import { ArrangementDesk } from "@/components/arrangement-desk";
import { ArrangementPill } from "@/components/arrangement-status";
import { StatusPill, TypeTag } from "@/components/status";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { listGiftQueue } from "@/lib/arrangements";
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{visit.visitCode}</span>
                      <TypeTag>{GUEST_KIND_LABEL[kind]}</TypeTag>
                      <StatusPill status={visit.status} />
                      <ArrangementPill status={visit.giftStatus} />
                    </div>
                    <span className="text-[12px] text-[var(--muted)]">{fmtDateTime(visit.expectedArrival)}</span>
                  </div>
                  <p className="mt-2 text-[15px] font-medium">{guest}</p>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">
                    {visit.department.name}
                    {visit.host?.name ? ` · Host ${visit.host.name}` : ""}
                    {` · Requested by ${visit.createdBy.name}`}
                  </p>
                  <p className="mt-2 text-[13px]">{visit.purpose}</p>
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
