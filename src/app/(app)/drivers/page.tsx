import { redirect } from "next/navigation";
import { ArrangementDesk } from "@/components/arrangement-desk";
import { ArrangementPill } from "@/components/arrangement-status";
import { StatusPill, TypeTag } from "@/components/status";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { canSeeDrivers } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function DriverRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; confirmed?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canSeeDrivers(session)) redirect("/dashboard");
  const query = await searchParams;
  const visits = await prisma.visit.findMany({
    where: { driverRequired: true, OR: [{ driverStatus: "PENDING" }, { driverStatus: null }] },
    include: {
      createdBy: true,
      department: true,
      host: true,
      visitors: { include: { visitor: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Driver requests"
        description="Contact the driver, then confirm the trip. The requester is told when it is confirmed."
      />
      {query.error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.error}
        </p>
      ) : null}
      {query.confirmed ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          Driver confirmed.
        </p>
      ) : null}
      {visits.length === 0 ? (
        <Card>
          <p className="text-sm font-medium">No open driver requests.</p>
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
                      <ArrangementPill status={visit.driverStatus} />
                    </div>
                    <span className="text-[12px] text-[var(--muted)]">{fmtDateTime(visit.expectedArrival)}</span>
                  </div>
                  <p className="mt-2 text-[15px] font-medium">{guest}</p>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">
                    {visit.department.name}
                    {` · Requested by ${visit.createdBy.name}`}
                  </p>
                  <p className="mt-2 text-[13px]">{visit.purpose}</p>
                </div>
                <div className="px-4 py-3">
                  <ArrangementDesk
                    visit={visit}
                    canComplete={false}
                    canCompleteDriver
                    canApprove={false}
                    from="drivers"
                    showGift={false}
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
