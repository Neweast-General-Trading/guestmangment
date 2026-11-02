import Link from "next/link";
import { Inbox, MailOpen, ShieldAlert } from "lucide-react";
import { importEmailAction, syncInboxAction } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { InboxAutoSync } from "@/components/inbox-auto-sync";
import { VisitStatus, TypeTag } from "@/components/status";
import { Button, Card, PageHeader, TextInput, Textarea } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { guestRequestTemplate } from "@/lib/email-template";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { peekInbox } from "@/lib/inbox-sync";
import { isDummyMail, roomMailStatus, roomMailTitle, visitCodeFromSubject, type InboxHead } from "@/lib/graph";
import { preparationLabel } from "@/lib/preparation";
import { canManageIntake } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { visitInclude } from "@/lib/visits";
import { redirect } from "next/navigation";

const KIND_TONE: Record<string, string> = {
  VIP: "VIP",
  SUPPLIER: "SUPPLIER",
  CUSTOMER: "CUSTOMER",
  GUEST: "GUEST",
};

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageIntake(session.role)) redirect("/dashboard");
  const { error } = await searchParams;
  const inbox = await peekInbox().catch(() => ({ requests: [] as InboxHead[], rooms: [] as InboxHead[] }));
  const [queued, ingested, repliedRows] = await Promise.all([
    prisma.visit.findMany({
      where: { source: { in: ["EMAIL", "STAFF"] }, status: { in: ["INTAKE", "ESCALATED", "EXPECTED"] } },
      include: visitInclude,
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.visit.findMany({
      where: { emailMessageId: { in: inbox.requests.map((item) => item.internetMessageId) } },
      select: { emailMessageId: true },
    }),
    prisma.visit.findMany({
      where: { roomConfirmRepliedAt: { not: null } },
      select: { visitCode: true },
    }),
  ]);
  const visits = queued.filter((item) => !isDummyMail(item.emailSubject || "", item.emailFrom || ""));
  const taken = new Set(ingested.map((item) => item.emailMessageId).filter(Boolean));
  const repliedCodes = new Set(repliedRows.map((item) => item.visitCode));
  const otherRequests = inbox.requests.filter((item) => !taken.has(item.internetMessageId));
  const requestRows = [
    ...visits.map((visit) => ({ key: visit.id, at: visit.createdAt.getTime(), visit })),
    ...otherRequests.map((mail) => ({ key: mail.id, at: Date.parse(mail.receivedAt) || 0, mail })),
  ].sort((a, b) => b.at - a.at);
  const counts = {
    intake: visits.filter((item) => preparationLabel(item) === "Preparing").length,
    escalated: visits.filter((item) => item.tourType === "BUILDING" && item.tourStatus === "PENDING").length,
    rooms: inbox.rooms.length,
  };
  const template = guestRequestTemplate();

  return (
    <div>
      <PageHeader
        title="Visit requests"
        description="Staff and email requests. Confirm the room, then the guard receives the visit."
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

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat icon={Inbox} label="Preparing" value={counts.intake} />
        <Stat icon={ShieldAlert} label="Building tours" value={counts.escalated} />
        <Stat icon={MailOpen} label="Room replies" value={counts.rooms} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-white p-4">
          <SectionTitle
            title="Visit requests"
            count={requestRows.length}
            hint="Newest first · staff requests and guest@neweast.co"
          />
          <div className="mt-3 max-h-[calc(100vh-16rem)] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {requestRows.length === 0 ? (
              <Card>
                <p className="text-sm font-medium">No visit request emails waiting.</p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  Fill the Excel template and send it as an attachment to guest@neweast.co. Click Sync inbox to create the request. You can also paste the text block on the right.
                </p>
              </Card>
            ) : (
              requestRows.map((row) => {
                if ("mail" in row) return <MailCard key={row.key} item={row.mail} kind="request" />;
                const visit = row.visit;
                const guest = visit.visitors[0]?.visitor;
                const kind = (visit.guestKind || "GUEST") as GuestKind;
                return (
                  <Link
                    key={row.key}
                    href={`/intake/${visit.id}`}
                    className="block rounded-xl border border-[var(--line)] bg-[#fcfafa] p-4 hover:border-[var(--line-strong)] hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium leading-snug text-[var(--ink)]">
                          {(visit.visitTitle || visit.purpose || "Guest visit").trim()} - {visit.createdBy?.name || "NEWEAST"}
                        </div>
                        <div className="mt-1 text-[13px] text-[var(--muted)]">
                          {visit.meetingRoom || "Room not set"}
                          <span className="text-[var(--faint)]"> · {fmtDateTime(visit.expectedArrival)}</span>
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
                    {visit.roomConfirmRepliedAt ? (
                      <div className="mt-2 text-[12px] font-medium text-[#2f7d6d]">Notes · Reply done</div>
                    ) : null}
                  </Link>
                );
              })
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
