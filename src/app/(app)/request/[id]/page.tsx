import { notFound, redirect } from "next/navigation";
import { ArrangementPill } from "@/components/arrangement-status";
import { CancelVisit } from "@/components/cancel-visit";
import { GatePassButton } from "@/components/gate-pass-button";
import { GatePassFiles } from "@/components/gate-pass-files";
import { StaffRequestForm, type StaffRequestEdit } from "@/components/staff-request-form";
import { VisitStatus, TypeTag } from "@/components/status";
import { Button, Card, PageHeader } from "@/components/ui";
import { arrangementHint } from "@/lib/arrangement-types";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { canManageIntake, canSeeAllVisits, canSeePasses, isGatePassApprover, mayCancelVisit } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { invitationTeamNames, listRoomInvitePeople, parseStoredInvitees } from "@/lib/room-booking";
import { guestDocHref, parseGuestDocs } from "@/lib/guest-doc-types";
import { preparationNote } from "@/lib/preparation";
import { canEditStaffRequest } from "@/lib/staff-request";
import { timeStamp, todayStamp } from "@/lib/visit-schedule";

export default async function StaffRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; files?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  const { id } = await params;
  const { error, saved, files } = await searchParams;
  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      department: true,
      createdBy: true,
      lineManager: true,
      visitors: { include: { visitor: true }, orderBy: [{ sortOrder: "asc" }, { isPrimary: "desc" }] },
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
  const canEdit = canEditStaffRequest(session, visit);
  const seeDocs = isGatePassApprover(session) || canSeePasses(session) || visit.createdById === session.id;
  const [departments, people] = canEdit
    ? await Promise.all([
        prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        listRoomInvitePeople(),
      ])
    : [[], []];
  const edit: StaffRequestEdit | null = canEdit
    ? {
        id: visit.id,
        visitDate: todayStamp(visit.expectedArrival),
        arrivalTime: timeStamp(visit.expectedArrival),
        endTime: visit.expectedDeparture ? timeStamp(visit.expectedDeparture) : "",
        departmentId: visit.departmentId,
        guestKind: visit.guestKind || "GUEST",
        tourType: visit.tourType || "NONE",
        meetingRoom: visit.meetingRoom || "",
        visitTitle: visit.visitTitle,
        purpose: visit.purpose,
        driverRequired: visit.driverRequired,
        guests: visit.visitors.map((link, index) => {
          const own = parseGuestDocs(link.attachmentsJson);
          const legacy = index === 0 && !own.length ? parseGuestDocs(visit.attachmentsJson) : [];
          const markedPass = visit.visitors.some((item) => item.gatePassRequired);
          const markedGift = visit.visitors.some((item) => item.giftRequired);
          return {
            linkId: link.id,
            fullName: link.visitor.fullName,
            mobile:
              link.visitor.mobile.startsWith("pending:") || link.visitor.mobile.startsWith("inbox:")
                ? ""
                : link.visitor.mobile,
            email: link.visitor.email || "",
            company: link.visitor.company || "",
            jobTitle: link.visitor.jobTitle || "",
            nationality: link.visitor.nationality || "",
            gatePassRequired: link.gatePassRequired || (!markedPass && visit.gatePassRequired),
            giftRequired: link.giftRequired || (!markedGift && visit.giftRequired),
            giftType: link.giftType || visit.giftType || "Welcome gift",
            docs: seeDocs
              ? (own.length ? own : legacy).map((doc) => ({
                  type: doc.type,
                  name: doc.name,
                  href: own.length ? guestDocHref(visit.id, doc.type, link.id) : guestDocHref(visit.id, doc.type),
                }))
              : [],
          };
        }),
        invitees: parseStoredInvitees(visit.colleagueInvitees),
      }
    : null;
  const docs = parseGuestDocs(visit.attachmentsJson);
  const directory = await prisma.user.findMany({ where: { isActive: true }, select: { email: true, name: true } });
  const team = invitationTeamNames(visit.colleagueInvitees, new Map(directory.map((person) => [person.email.toLowerCase(), person.name])));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${(visit.visitTitle || visit.purpose || "Guest visit").trim()} - ${visit.createdBy.name}`}
        description={[`${visit.meetingRoom || "Room not set"} · ${visit.visitCode}`, preparationNote(visit)].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <TypeTag>{GUEST_KIND_LABEL[kind]}</TypeTag>
            <VisitStatus visit={visit} />
            {mayCancelVisit(session, visit) ? <CancelVisit visitId={visit.id} returnTo={`/request/${visit.id}`} /> : null}
            <Button href="/request?tab=history" variant="secondary">
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
      {saved ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">Changes saved.</p>
      ) : null}
      {files ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {files}
        </p>
      ) : null}

      {visit.createdById === session.id || canSeePasses(session) || canManageIntake(session.role) ? (
        <GatePassFiles
          visitId={visit.id}
          visitFile={visit.gatePassFile}
          people={visit.visitors.map((link) => ({ id: link.id, name: link.visitor.fullName, file: link.gatePassFile }))}
        />
      ) : null}

      {edit ? (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold">Edit request</h2>
          <p className="mt-1 mb-4 text-[13px] text-[var(--muted)]">
            Change any detail. Saving sends the updated request to reception.
          </p>
          <StaffRequestForm
            departments={departments.map((item) => ({ value: item.id, label: item.name }))}
            departmentId={visit.departmentId}
            today={todayStamp()}
            people={people}
            bookerEmail={visit.createdBy.email}
            edit={edit}
          />
        </Card>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card tone="sky">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">When</div>
          <div className="mt-1 text-[13px] font-medium">
            {fmtDateTime(visit.expectedArrival)}
            {visit.expectedDeparture ? ` – ${fmtTime(visit.expectedDeparture)}` : ""}
          </div>
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
            {visit.meetingRoom || "N/A"}
          </div>
          <div className="text-[12px] text-[var(--muted)]">
            {visit.meetingRoom ? "Proposed room" : "Reception will assign the room"}
          </div>
        </Card>
      </div>

      {team.length ? (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold">Invitation team</h2>
          <ul className="mt-3 space-y-1">
            {team.map((person) => (
              <li key={person.email} className="text-[13px] text-[var(--ink)]">
                {person.name}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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
                  ? "The driver is confirmed."
                  : "Sachini will contact the driver and confirm."}
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
                  ? "Reception uploaded the gate pass."
                  : visit.gatePassStatus === "PREPARING"
                    ? "Reception approved the gate pass and will upload it when it is ready."
                    : "Reception will review this gate pass."}
              </p>
              {visit.gatePassNote ? <p className="mt-2 whitespace-pre-wrap text-[13px]">{visit.gatePassNote}</p> : null}
              {visit.gatePassStatus === "DONE" && visit.gatePassFile ? <GatePassButton href={`/api/gate-passes/${visit.id}`} /> : null}
            </Card>
          ) : null}
        </div>
      ) : null}

      <Card className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Title of visit</div>
        <p className="mt-1 text-[14px]">{visit.visitTitle || visit.purpose}</p>
        {visit.purpose && visit.purpose !== visit.visitTitle ? (
          <p className="mt-3 text-[13px] text-[var(--muted)]">{visit.purpose}</p>
        ) : null}
      </Card>

      <Card className="mb-4">
        <h2 className="text-sm font-semibold">Guests</h2>
        <ul className="mt-3 space-y-3">
          {visit.visitors.map((link) => {
            const guest = link.visitor;
            const mobile = guest.mobile.startsWith("inbox:") || guest.mobile.startsWith("pending:") ? "" : guest.mobile;
            const extra = [guest.jobTitle, guest.company, guest.nationality].filter(Boolean).join(" · ");
            return (
              <li key={link.id} className="rounded-xl border border-[var(--line)] bg-[#fcfafa] px-3 py-2">
                <div className="text-[13px] font-medium">{guest.fullName}</div>
                {extra ? <div className="text-[12px] text-[var(--muted)]">{extra}</div> : null}
                {mobile || guest.email ? (
                  <div className="text-[12px] text-[var(--muted)]">{[mobile, guest.email].filter(Boolean).join(" · ")}</div>
                ) : null}
                {link.gatePassRequired || (!visit.visitors.some((item) => item.gatePassRequired) && visit.gatePassRequired) ? (
                  <div className="mt-1 text-[12px]">
                    Gate pass · {link.gatePassStatus || visit.gatePassStatus || "Waiting"}
                    {link.gatePassFile || visit.gatePassFile ? (
                      <div>
                        <GatePassButton href={link.gatePassFile ? `/api/gate-passes/${visit.id}/${link.id}` : `/api/gate-passes/${visit.id}`} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {link.giftRequired || (!visit.visitors.some((item) => item.giftRequired) && visit.giftRequired) ? (
                  <div className="text-[12px]">Gift · {link.giftType || visit.giftType || "Protocol gift"} · {link.giftStatus || visit.giftStatus || "Waiting"}</div>
                ) : null}
                {seeDocs && parseGuestDocs(link.attachmentsJson).length ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {parseGuestDocs(link.attachmentsJson).map((doc) => (
                      <a key={doc.type} className="text-[12px] font-medium text-[var(--brand-ink)]" href={guestDocHref(visit.id, doc.type, link.id)}>
                        {doc.type === "PASSPORT" ? "Passport" : doc.type === "VISA" ? "Visa" : "ID"}
                      </a>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {seeDocs && docs.length && !canEdit ? (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold">Documents</h2>
          <ul className="mt-3 space-y-2">
            {docs.map((doc) => (
              <li key={doc.type}>
                <a className="text-[13px] font-medium text-[var(--brand-ink)]" href={guestDocHref(visit.id, doc.type)}>
                  {doc.type === "PASSPORT" ? "Passport" : doc.type === "VISA" ? "Visa" : "ID"} · {doc.name}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {visit.intakeNotes ? (
        <Card className="mb-4" tone="mint">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Comment</div>
          <p className="mt-1 whitespace-pre-wrap text-[13px]">{visit.intakeNotes}</p>
        </Card>
      ) : null}
    </div>
  );
}
