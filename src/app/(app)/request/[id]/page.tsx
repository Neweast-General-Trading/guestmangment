import { notFound, redirect } from "next/navigation";
import { decideStaffRequestAction } from "@/app/actions";
import { ArrangementPill } from "@/components/arrangement-status";
import { FormBusy } from "@/components/form-busy";
import { StatusPill, TypeTag } from "@/components/status";
import { Button, Card, PageHeader, Textarea } from "@/components/ui";
import { arrangementHint } from "@/lib/arrangement-types";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { canSeeAllVisits } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function StaffRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  const { id } = await params;
  const { error } = await searchParams;
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      department: true,
      createdBy: true,
      lineManager: true,
      visitors: { include: { visitor: true }, orderBy: { isPrimary: "desc" } },
    },
  });
  if (!visit || visit.source !== "STAFF") notFound();
  const allowed =
    canSeeAllVisits(session.role) ||
    visit.createdById === session.id ||
    visit.lineManagerId === session.id ||
    session.role === "HR_ADMIN";
  if (!allowed) redirect("/request");

  const kind = (visit.guestKind || "GUEST") as GuestKind;
  const canDecide = visit.status === "MANAGER_REVIEW" && (visit.lineManagerId === session.id || session.role === "SYSTEM_ADMIN");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={visit.visitCode}
        description={`Requested by ${visit.createdBy.name}`}
        actions={
          <div className="flex items-center gap-2">
            <TypeTag>{GUEST_KIND_LABEL[kind]}</TypeTag>
            <StatusPill status={visit.status} />
            <Button href={canDecide ? "/request?tab=approve" : "/request?tab=history"} variant="secondary">
              Back
            </Button>
          </div>
        }
      />
      {error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {error}
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card tone="sky">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">When</div>
          <div className="mt-1 text-[13px] font-medium">{fmtDateTime(visit.expectedArrival)}</div>
          <div className="text-[12px] text-[var(--muted)]">{visit.department.name}</div>
        </Card>
        <Card tone="sand">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Party</div>
          <div className="mt-1 text-[13px] font-medium">
            {visit.visitorCount} {visit.visitorCount === 1 ? "guest" : "guests"}
          </div>
          <div className="text-[12px] text-[var(--muted)]">
            {arrangementHint(visit) || "No driver or gift"}
          </div>
        </Card>
        <Card tone="sage">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Next</div>
          <div className="mt-1 text-[13px] font-medium">
            {visit.status === "MANAGER_REVIEW"
              ? visit.lineManager?.name || "Line manager"
              : visit.status === "INTAKE"
                ? "Administration"
                : visit.meetingRoom || "—"}
          </div>
          <div className="text-[12px] text-[var(--muted)]">{visit.meetingRoom || "Room not set"}</div>
        </Card>
      </div>

      {visit.driverRequired || visit.giftRequired || visit.gatePassRequired ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {visit.driverRequired ? (
            <Card tone={visit.driverStatus === "DONE" ? "sage" : "sand"}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Driver and car</div>
                <ArrangementPill status={visit.driverStatus} />
              </div>
              <p className="mt-2 text-[13px] text-[var(--muted)]">
                {visit.driverStatus === "DONE"
                  ? "Reception contacted the driver and confirmed the trip."
                  : visit.status === "MANAGER_REVIEW"
                    ? "After approval, Reception will contact the driver."
                    : "Reception will contact the driver and confirm."}
              </p>
              {visit.driverNote ? <p className="mt-2 whitespace-pre-wrap text-[13px]">{visit.driverNote}</p> : null}
            </Card>
          ) : null}
          {visit.giftRequired ? (
            <Card tone={visit.giftStatus === "DONE" ? "sage" : visit.giftStatus === "PREPARING" ? "sky" : "lilac"}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Protocol gift</div>
                <ArrangementPill status={visit.giftStatus} />
              </div>
              <p className="mt-2 text-[15px] font-medium">{visit.giftType || "Protocol gift"}</p>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                {visit.giftStatus === "DONE"
                  ? "Reception received the gift."
                  : visit.giftStatus === "PREPARING"
                    ? "Marketing approved. The gift is being prepared."
                    : visit.status === "MANAGER_REVIEW"
                      ? "After approval, Marketing will review this gift."
                      : "Marketing will review this gift."}
              </p>
              {visit.giftNote ? <p className="mt-2 whitespace-pre-wrap text-[13px]">{visit.giftNote}</p> : null}
            </Card>
          ) : null}
          {visit.gatePassRequired ? (
            <Card tone={visit.gatePassStatus === "DONE" ? "sage" : visit.gatePassStatus === "PREPARING" ? "sky" : "lilac"}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Gate pass</div>
                <ArrangementPill status={visit.gatePassStatus} />
              </div>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                {visit.gatePassStatus === "DONE"
                  ? "Reception has the gate pass."
                  : visit.gatePassStatus === "PREPARING"
                    ? "HR approved. The gate pass is being prepared."
                    : visit.status === "MANAGER_REVIEW"
                      ? "After approval, HR will review this gate pass."
                      : "HR will review this gate pass."}
              </p>
              {visit.gatePassNote ? <p className="mt-2 whitespace-pre-wrap text-[13px]">{visit.gatePassNote}</p> : null}
            </Card>
          ) : null}
        </div>
      ) : null}

      <Card className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Purpose</div>
        <p className="mt-1 text-[14px]">{visit.purpose}</p>
      </Card>

      <Card className="mb-4">
        <h2 className="text-sm font-semibold">Guests</h2>
        <ul className="mt-3 space-y-3">
          {visit.visitors.map((link) => {
            const guest = link.visitor;
            const mobile = guest.mobile.startsWith("inbox:") ? "" : guest.mobile;
            const extra = [guest.jobTitle, guest.company, guest.nationality].filter(Boolean).join(" · ");
            return (
              <li key={link.id} className="rounded-xl border border-[var(--line)] bg-[#fcfafa] px-3 py-2">
                <div className="text-[13px] font-medium">{guest.fullName}</div>
                {extra ? <div className="text-[12px] text-[var(--muted)]">{extra}</div> : null}
                {mobile || guest.email ? (
                  <div className="text-[12px] text-[var(--muted)]">{[mobile, guest.email].filter(Boolean).join(" · ")}</div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {visit.intakeNotes && !canDecide ? (
        <Card className="mb-4" tone="mint">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Comment</div>
          <p className="mt-1 whitespace-pre-wrap text-[13px]">{visit.intakeNotes}</p>
        </Card>
      ) : null}

      {canDecide ? (
        <Card tone="sand">
          <h2 className="text-sm font-semibold">Your decision</h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Add a comment, then approve or decline.</p>
          <form action={decideStaffRequestAction} className="mt-4 space-y-3">
            <FormBusy label="Saving decision…" />
            <input type="hidden" name="visitId" value={visit.id} />
            <Textarea name="note" placeholder="Comment" />
            <div className="flex gap-2">
              <button
                name="decision"
                value="APPROVED"
                className="inline-flex h-8 items-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)]"
              >
                Approve
              </button>
              <button
                name="decision"
                value="REJECTED"
                className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium"
              >
                Decline
              </button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
