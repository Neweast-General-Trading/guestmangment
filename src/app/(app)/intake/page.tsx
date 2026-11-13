import { requestNow } from "@/lib/visit-order";
import Link from "next/link";
import { Inbox, MailOpen, ShieldAlert } from "lucide-react";
import { importEmailAction, syncInboxAction } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { InboxAutoSync } from "@/components/inbox-auto-sync";
import { CancelVisit } from "@/components/cancel-visit";
import { InboxMailCard } from "@/components/inbox-mail-card";
import { VisitStatus, TypeTag } from "@/components/status";
import { Button, Card, PageHeader, TextInput, Textarea } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { guestRequestTemplate } from "@/lib/email-template";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { endOfDay, startOfDay } from "date-fns";
import { CalendarClock } from "lucide-react";
import { DayGroupCard, DayHeader, WhenChip } from "@/components/day-header";
import { groupByDay, isLive, relativeWhen, upcomingFirst, visitEnd, type DayGroup } from "@/lib/visit-order";
import { peekInbox } from "@/lib/inbox-sync";
import { isDummyMail, roomMailStatus, roomMailTitle, visitCodeFromSubject, type InboxHead } from "@/lib/graph";
import { preparationLabel, preparationNote } from "@/lib/preparation";
import { canManageIntake, mayCancelVisit, type SessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { invitationTeamNames } from "@/lib/room-booking";
import { visitInclude, type FullVisit } from "@/lib/visits";
import { redirect } from "next/navigation";

const HIDDEN_CODES = ["GV-2026-000010", "GV-2026-000015"];

const KIND_TONE: Record<string, string> = {
  VIP: "VIP",
  SUPPLIER: "SUPPLIER",
  CUSTOMER: "CUSTOMER",
  GUEST: "GUEST",
};

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageIntake(session.role)) redirect("/dashboard");
  const { error, tab: tabQuery } = await searchParams;
  const tab = tabQuery === "history" ? "history" : "current";
  const inbox = await peekInbox().catch(() => ({ requests: [] as InboxHead[], rooms: [] as InboxHead[] }));
  const [queued, ingested, repliedRows, directory] = await Promise.all([
    prisma.visit.findMany({
      where: { source: { in: ["EMAIL", "STAFF"] }, visitCode: { notIn: HIDDEN_CODES } },
      include: visitInclude,
      orderBy: { expectedArrival: "desc" },
    }),
    prisma.visit.findMany({
      where: { emailMessageId: { in: inbox.requests.map((item) => item.internetMessageId) } },
      select: { emailMessageId: true },
    }),
    prisma.visit.findMany({
      where: { roomConfirmRepliedAt: { not: null } },
      select: { visitCode: true },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { email: true, name: true } }),
  ]);
  const knownNames = new Map(directory.map((person) => [person.email.toLowerCase(), person.name]));
  const visits = queued.filter((item) => !isDummyMail(item.emailSubject || "", item.emailFrom || ""));
  const now = requestNow();
  // Current: still ahead or under way, soonest first. History: over or closed, newest first.
  const ordered = upcomingFirst(visits, now);
  const upcoming = ordered.filter((item) => isLive(item, now));
  const past = ordered.filter((item) => !isLive(item, now));
  const todayEnd = endOfDay(new Date(now)).getTime();
  const todayLeft = upcoming.filter((item) => item.expectedArrival.getTime() <= todayEnd).length;
  const taken = new Set(ingested.map((item) => item.emailMessageId).filter(Boolean));
  const repliedCodes = new Set(repliedRows.map((item) => item.visitCode));
  const otherRequests = inbox.requests
    .filter((item) => !taken.has(item.internetMessageId))
    .sort((a, b) => (Date.parse(b.receivedAt) || 0) - (Date.parse(a.receivedAt) || 0));
  const counts = {
    intake: upcoming.filter((item) => {
      const label = preparationLabel(item);
      return label === "Preparing" || label === "Meeting room confirmed";
    }).length,
    escalated: upcoming.filter((item) => item.tourType === "BUILDING" && item.tourStatus === "PENDING").length,
    rooms: inbox.rooms.length,
  };
  const template = guestRequestTemplate();

  return (
    <div>
      <PageHeader
        title="Visit requests"
        description="Current shows meetings still ahead. History shows meetings that have passed or were cancelled."
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href="/templates/NEWEAST-Guest-Request.xlsx"
              download="NEWEAST-Guest-Request.xlsx"
              className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium text-[var(--ink)] hover:bg-[#faf7f7]"
            >
              Download Excel template
            </a>
            <CopyButton text={template} />
            <form action={syncInboxAction}>
              <Button type="submit">Sync inbox</Button>
            </form>
          </div>
        }
      />
      {error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {error}
        </p>
      ) : null}
      <InboxAutoSync />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={CalendarClock} label="Still today" value={todayLeft} />
        <Stat icon={Inbox} label="Preparing" value={counts.intake} />
        <Stat icon={ShieldAlert} label="Building tours" value={counts.escalated} />
        <Stat icon={MailOpen} label="Room replies" value={counts.rooms} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-white p-4">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[#faf7f7] p-1">
            {(
              [
                { id: "current", label: "Current", count: upcoming.length + otherRequests.length },
                { id: "history", label: "History", count: past.length },
              ] as const
            ).map((item) => {
              const active = tab === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.id === "current" ? "/intake" : "/intake?tab=history"}
                  className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] whitespace-nowrap ${
                    active ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "text-[var(--muted)] hover:bg-[#faf4f4]"
                  }`}
                >
                  {item.label}
                  <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] ${active ? "bg-white" : "bg-[#f4eeee]"}`}>
                    {item.count}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-[var(--muted)]">
            {tab === "history"
              ? "Meetings that are over or were cancelled. Newest first, one block per day."
              : "Happening now first, then today, then the days ahead in time order. New mail stays at the top."}
          </p>
          <div className="mt-3 space-y-3">
            {tab === "history" ? (
              past.length === 0 ? (
                <Card>
                  <p className="text-sm font-medium">No past or cancelled meetings.</p>
                </Card>
              ) : (
                groupByDay(past, now).map((group) => (
                  <DaySection key={group.key} group={group} now={now} session={session} returnTo="/intake?tab=history" knownNames={knownNames} />
                ))
              )
            ) : upcoming.length + otherRequests.length === 0 ? (
              <Card>
                <p className="text-sm font-medium">No upcoming meetings.</p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  Fill the Excel template and send it as an attachment to guest@neweast.co. Click Sync inbox to create the request. You can also paste the text block on the right.
                </p>
              </Card>
            ) : (
              <>
                {otherRequests.length ? (
                  // Folded unless something arrived today, so old mail never pushes today's visits down.
                  <details className="group space-y-3" open={otherRequests.some((item) => Date.parse(item.receivedAt) >= startOfDay(new Date(now)).getTime())}>
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <DayHeader
                        group={{ label: "New emails", hint: "Not turned into a visit yet · click to show or hide", tone: "today", count: otherRequests.length }}
                      />
                    </summary>
                    <div className="mt-3 space-y-3">
                    {otherRequests.map((item) => (
                      <InboxMailCard
                        key={item.id}
                        id={item.id}
                        subject={item.subject}
                        from={item.from}
                        fromName={item.fromName}
                        receivedAt={item.receivedAt ? fmtDateTime(item.receivedAt) : ""}
                      />
                    ))}
                    </div>
                  </details>
                ) : null}
                {groupByDay(upcoming, now).map((group) => (
                  <DaySection key={group.key} group={group} now={now} session={session} returnTo="/intake" knownNames={knownNames} />
                ))}
              </>
            )}
          </div>
        </section>

        <aside className="space-y-4">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <SectionTitle
            title="Meeting room replies"
            count={inbox.rooms.length}
            hint="Newest first · accepted and declined mail from the rooms"
          />
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {inbox.rooms.length === 0 ? (
              <Card>
                <p className="text-sm font-medium">No meeting-room replies in the inbox.</p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  When a room accepts or declines a booking, that mail lands here — not with visit requests.
                </p>
              </Card>
            ) : (
              inbox.rooms.map((item) => {
                const code = visitCodeFromSubject(item.subject);
                return <MailCard key={item.id} item={item} kind="room" replied={Boolean(code && repliedCodes.has(code))} />;
              })
            )}
          </div>
        </section>

          <Card>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Fixed template</h2>
                <p className="mt-1 text-[12px] text-[var(--muted)]">
                  Attach the filled Excel file, or keep this block inside the email.
                </p>
              </div>
              <a
                href="/templates/NEWEAST-Guest-Request.xlsx"
                download="NEWEAST-Guest-Request.xlsx"
                className="inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--line)] bg-white px-2.5 text-[12px] font-medium hover:bg-[#faf7f7]"
              >
                Excel
              </a>
            </div>
            <pre className="mt-3 max-h-36 overflow-auto rounded-xl border border-[var(--line)] bg-[#f7f4f4] p-3 text-[11px] leading-5 text-[var(--ink)]">
              {template}
            </pre>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold">Paste an email</h2>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              Use this if mailbox sign-in is blocked. Paste the full message including the template.
            </p>
            <form action={importEmailAction} className="mt-3 space-y-2">
              <TextInput name="emailFrom" placeholder="From (optional)" />
              <TextInput name="emailSubject" placeholder="Subject (optional)" />
              <Textarea name="emailText" placeholder="Paste the email here" required className="min-h-40" />
              <Button type="submit">Create request</Button>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
        <Icon size={14} strokeWidth={1.75} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function invitationTeam(visit: FullVisit, knownNames: Map<string, string>) {
  return invitationTeamNames(visit.colleagueInvitees, knownNames).map((person) => person.name);
}

function DaySection({
  group,
  now,
  session,
  returnTo,
  knownNames,
}: {
  group: DayGroup<FullVisit>;
  now: number;
  session: SessionUser;
  returnTo: string;
  knownNames: Map<string, string>;
}) {
  return (
    <DayGroupCard
      group={{ label: group.label, hint: group.hint, tone: group.tone, count: group.items.length }}
      preview={group.items.map((visit) => ({
        id: visit.id,
        time: fmtTime(visit.expectedArrival),
        title: (visit.visitTitle || visit.purpose || "Guest visit").trim(),
        room: visit.meetingRoom || "No room",
        now: relativeWhen(visit, now) === "Now",
      }))}
    >
      {group.items.map((visit) => (
        <VisitRequestCard
          key={visit.id}
          visit={visit}
          session={session}
          returnTo={returnTo}
          knownNames={knownNames}
          when={relativeWhen(visit, now)}
          tone={group.tone}
        />
      ))}
    </DayGroupCard>
  );
}

const CARD_TONE: Record<DayGroup<unknown>["tone"], string> = {
  now: "border-[var(--brand)] bg-white shadow-[0_0_0_3px_var(--brand-soft)]",
  today: "border-[var(--line-strong)] bg-white",
  ahead: "border-[var(--line)] bg-[#fcfafa]",
  past: "border-[var(--line)] bg-[#faf9f9] opacity-85",
};

function VisitRequestCard({
  visit,
  session,
  returnTo,
  knownNames,
  when,
  tone,
}: {
  visit: FullVisit;
  session: SessionUser;
  returnTo: string;
  knownNames: Map<string, string>;
  when: string;
  tone: DayGroup<unknown>["tone"];
}) {
  const guest = visit.visitors[0]?.visitor;
  const kind = (visit.guestKind || "GUEST") as GuestKind;
  const team = invitationTeam(visit, knownNames);
  return (
    <div className={`rounded-xl border p-4 hover:border-[var(--line-strong)] hover:bg-white ${CARD_TONE[tone]}`}>
      <Link href={`/intake/${visit.id}`} className="flex gap-4">
        <div className="flex w-[68px] shrink-0 flex-col items-start border-r border-[var(--line)] pr-3">
          <span className="text-[18px] font-semibold leading-none tabular-nums text-[var(--ink)]">{fmtTime(visit.expectedArrival)}</span>
          <span className="mt-1 text-[11px] text-[var(--muted)] tabular-nums">to {fmtTime(visitEnd(visit))}</span>
          <span className="mt-2">
            <WhenChip label={when} tone={tone} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-medium leading-snug text-[var(--ink)]">
              {(visit.visitTitle || visit.purpose || "Guest visit").trim()} - {visit.createdBy?.name || "NEWEAST"}
            </div>
            <div className="mt-1 text-[13px] text-[var(--muted)]">
              {[visit.meetingRoom || "Room not set", preparationNote(visit)].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <TypeTag type={KIND_TONE[kind]}>{GUEST_KIND_LABEL[kind]}</TypeTag>
            <VisitStatus visit={visit} />
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--line)] pt-2">
          <div className="min-w-0 text-[12px] text-[var(--muted)]">
            <span className="text-[var(--ink)]">{guest?.fullName || "Guest not named"}</span>
            {guest?.company ? ` · ${guest.company}` : ""}
            {` · ${visit.visitorCount} ${visit.visitorCount === 1 ? "guest" : "guests"}`}
            {visit.driverRequired ? " · Driver" : ""}
            {visit.giftRequired ? " · Gift" : ""}
            {visit.gatePassRequired ? " · Gate pass" : ""}
          </div>
          <div className="shrink-0 text-right text-[11px] text-[var(--faint)]">{visit.visitCode}</div>
        </div>
        {team.length ? (
          <div className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">Invitation team:</span> {team.join(", ")}
          </div>
        ) : null}
        {visit.roomConfirmRepliedAt ? <div className="mt-2 text-[12px] font-medium text-[#2f7d6d]">Notes · Reply done</div> : null}
        </div>
      </Link>
      {mayCancelVisit(session, visit) ? (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <CancelVisit visitId={visit.id} returnTo={returnTo} />
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle({ title, count, hint }: { title: string; count: number; hint: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-[12px] text-[var(--muted)]">{count}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-[var(--muted)]">{hint}</p>
    </div>
  );
}

const ROOM_TONE: Record<string, string> = {
  accepted: "bg-[#e8f6ee] text-[#2f7d6d]",
  declined: "bg-[#fdecea] text-[#9a4a45]",
  pending: "bg-[#f8f1de] text-[#9a6b20]",
};

const ROOM_LABEL: Record<string, string> = {
  accepted: "Meeting room confirmed",
  declined: "Meeting room declined",
  pending: "Waiting for meeting room",
};

function MailCard({ item, kind, replied }: { item: InboxHead; kind: "request" | "room"; replied?: boolean }) {
  const reply = kind === "room" ? roomMailStatus(item.subject) : null;
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_1px_0_rgba(20,32,31,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {reply ? (
          <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ${ROOM_TONE[reply]}`}>
            {ROOM_LABEL[reply]}
          </span>
        ) : (
          <span className="inline-flex h-6 items-center rounded-full bg-[#e8f1f8] px-2 text-[11px] font-medium text-[#1d4f7a]">
            Visit request
          </span>
        )}
        <span className="text-[12px] text-[var(--muted)]">{item.receivedAt ? fmtDateTime(item.receivedAt) : ""}</span>
      </div>
      <div className="mt-2 text-[13px] font-medium">{kind === "room" ? roomMailTitle(item.subject) : item.subject || "No subject"}</div>
      <div className="mt-1 text-[12px] text-[var(--muted)]">
        {item.fromName || item.from}
        {item.fromName && item.from && item.fromName !== item.from ? ` · ${item.from}` : ""}
      </div>
      {replied ? <div className="mt-2 text-[12px] font-medium text-[#2f7d6d]">Notes · Reply done</div> : null}
    </div>
  );
}
