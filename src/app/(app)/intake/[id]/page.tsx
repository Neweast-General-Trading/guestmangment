import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { decideEscalationAction } from "@/app/actions";
import { ArrangementDesk } from "@/components/arrangement-desk";
import { FormBusy } from "@/components/form-busy";
import { IntakeForm } from "@/components/intake-form";
import { StatusPill, TypeTag } from "@/components/status";
import { Button, Card, PageHeader, Textarea } from "@/components/ui";
import { arrangementHint } from "@/lib/arrangement-types";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { meetingRoomOptions } from "@/lib/graph";
import { fmtDateTime } from "@/lib/format";
import { canApproveGatePass, canApproveGift, canDecideEscalation, canManageIntake } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { lookups } from "@/lib/queries";
import { timeStamp, todayStamp } from "@/lib/visit-schedule";
import { visitInclude } from "@/lib/visits";

export default async function IntakeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; confirmed?: string; escalated?: string; driver?: string; gift?: string; pass?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageIntake(session.role) && !canDecideEscalation(session)) redirect("/dashboard");
  const { id } = await params;
  const { error, saved, confirmed, escalated, driver, gift, pass } = await searchParams;
  const visit = await prisma.visit.findUnique({ where: { id }, include: visitInclude });
  if (!visit || (visit.source !== "EMAIL" && visit.source !== "STAFF")) notFound();
  const [{ hosts, departments }, rooms] = await Promise.all([lookups(), meetingRoomOptions()]);
  const kind = (visit.guestKind || "GUEST") as GuestKind;
  const locked = !["INTAKE", "ESCALATED"].includes(visit.status);
  const canEdit = canManageIntake(session.role) && visit.status === "INTAKE";
  const canDecide = visit.status === "ESCALATED" && canDecideEscalation(session);

  return (
    <div>
      <PageHeader
        title={visit.visitCode}
        description={`${GUEST_KIND_LABEL[kind]} request from ${visit.source === "STAFF" ? visit.createdBy.name : visit.emailFrom || "the guest inbox"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TypeTag type={kind}>{GUEST_KIND_LABEL[kind]}</TypeTag>
            <StatusPill status={visit.status} />
            <Button href="/intake" variant="secondary">
              Back to inbox
            </Button>
          </div>
        }
      />
      {error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {error}
        </p>
      ) : null}
      {saved || confirmed || escalated || driver || gift || pass ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          {escalated
            ? "Sent to Samir Ibrahim."
            : driver
              ? "Driver confirmed. The requester was notified."
              : gift
                ? "Gift status updated. The requester was notified."
              : pass
                ? "Gate pass status updated. The requester was notified."
            : confirmed
              ? "Room booked in Outlook. guest@neweast.co gets the confirmation from the room mailbox. Submit when ready for Security."
              : "Changes saved."}
        </p>
      ) : null}

      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        <Card tone="sky">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Schedule</div>
          <div className="mt-1 text-[13px] font-medium">{fmtDateTime(visit.expectedArrival)}</div>
          <div className="text-[12px] text-[var(--muted)]">{visit.department.name}</div>
        </Card>
        <Card tone="sand">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Party</div>
          <div className="mt-1 text-[13px] font-medium">
            {visit.visitorCount} {visit.visitorCount === 1 ? "guest" : "guests"}
          </div>
          <div className="text-[12px] text-[var(--muted)]">
            {arrangementHint(visit) || (visit.driverRequired ? "Driver requested" : "No extra arrangements")}
          </div>
        </Card>
        <Card tone="sage">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Preparation</div>
          <div className="mt-1 text-[13px] font-medium">{visit.meetingRoom || "Meeting room not set"}</div>
          <div className="text-[12px] text-[var(--muted)]">
            {visit.driverName
              ? `Driver ${visit.driverName}`
              : visit.driverRequired
                ? visit.driverStatus === "DONE"
                  ? "Driver confirmed"
                  : "Driver still to confirm"
                : visit.giftRequired
                  ? visit.giftStatus === "DONE"
                    ? "Gift received"
                    : "Gift in progress"
                  : "Ready for room confirm"}
          </div>
        </Card>
      </div>

      {visit.emailSubject || visit.emailFrom ? (
        <Card className="mb-5" tone="mint">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Source email</div>
          <div className="mt-1 text-[13px] font-medium">{visit.emailSubject || "No subject"}</div>
          <div className="text-[12px] text-[var(--muted)]">{visit.emailFrom}</div>
        </Card>
      ) : null}

      {visit.roomConfirmRepliedAt ? (
        <Card className="mb-5" tone="sage">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Notes</div>
          <div className="mt-1 text-[13px] font-medium text-[#2f7d6d]">Reply done</div>
          <div className="text-[12px] text-[var(--muted)]">
            Confirmation sent from guest@neweast.co · {fmtDateTime(visit.roomConfirmRepliedAt)}
          </div>
        </Card>
      ) : null}

      <ArrangementDesk
        visit={visit}
        canComplete={canManageIntake(session.role)}
        canApprove={canApproveGift(session)}
        canApprovePass={canApproveGatePass(session)}
        from="intake"
      />

      {canDecide ? (
        <Card className="mb-5" tone="sand">
          <h2 className="text-sm font-semibold">Samir decision</h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Approve to return this request to Administration. Reject closes it.
          </p>
          {visit.escalationNotes ? (
            <p className="mt-3 whitespace-pre-wrap text-[13px]">{visit.escalationNotes}</p>
          ) : null}
          <form action={decideEscalationAction} className="mt-4 space-y-2">
            <FormBusy label="Sending decision…" />
            <input type="hidden" name="visitId" value={visit.id} />
            <input type="hidden" name="from" value="intake" />
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
        </Card>
      ) : null}

      {visit.status === "ESCALATED" && !canDecide ? (
        <Card className="mb-5" tone="sand">
          <p className="text-[13px]">Waiting for Samir Ibrahim. Administration cannot submit until he approves.</p>
          {visit.escalationNotes ? <p className="mt-2 text-[12px] text-[var(--muted)]">{visit.escalationNotes}</p> : null}
        </Card>
      ) : null}

      {locked ? (
        <Card>
          <p className="text-[13px]">
            This request left the intake desk.{" "}
            <Link href={`/visits/${visit.id}`} className="font-medium text-[var(--brand-ink)]">
              Open the visit
            </Link>
            .
          </p>
        </Card>
      ) : (
        <IntakeForm
          visit={{
            id: visit.id,
            purpose: visit.purpose,
            visitDate: todayStamp(visit.visitDate),
            expectedArrival: timeStamp(visit.expectedArrival),
            departmentId: visit.departmentId,
            hostId: visit.hostId,
            guestKind: kind,
            meetingRoom: visit.meetingRoom || "",
            driverRequired: visit.driverRequired,
            driverName: visit.driverName || "",
            driverMobile: visit.driverMobile || "",
            driverVehicle: visit.driverVehicle || "",
            visitors: visit.visitors.map((link) => ({
              fullName: link.visitor.fullName,
              mobile: link.visitor.mobile.startsWith("inbox:") ? "" : link.visitor.mobile,
              email: link.visitor.email || "",
              company: link.visitor.company || "",
              jobTitle: link.visitor.jobTitle || "",
              nationality: link.visitor.nationality || "",
            })),
            canEscalate: canEdit && (kind === "CUSTOMER" || visit.type === "CUSTOMER"),
            locked: !canEdit,
          }}
          hosts={hosts.map((user) => ({
            value: user.id,
            label: user.name,
            hint: user.department?.name || user.jobTitle || "",
          }))}
          departments={departments.map((item) => ({ value: item.id, label: item.name }))}
          rooms={rooms}
        />
      )}
    </div>
  );
}
