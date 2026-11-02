import Link from "next/link";
import { StaffRequestForm } from "@/components/staff-request-form";
import { StatusPill, TypeTag } from "@/components/status";
import { Card, Empty, PageHeader } from "@/components/ui";
import { canUseRequestDesk, isRoomBooker } from "@/lib/access";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { listRoomInvitePeople } from "@/lib/room-booking";
import { todayStamp } from "@/lib/visit-schedule";

const TABS = [
  { id: "new", label: "New request" },
  { id: "history", label: "History" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default async function StaffRequestPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    sent?: string;
    manager?: string;
    direct?: string;
    decided?: string;
    tab?: string;
  }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  const query = await searchParams;
  const [departments, people, mine] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listRoomInvitePeople(),
    prisma.visit.findMany({
      where: { source: "STAFF", createdById: session.id },
      include: { visitors: { include: { visitor: true }, take: 1 }, department: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  const canDesk = canUseRequestDesk(session);
  const tab: Tab = query.tab === "history" || !canDesk ? "history" : "new";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Visit request"
        description="Submit a guest visit. It goes straight to reception. Open a request to edit every detail."
      />
      {query.error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.error}
        </p>
      ) : null}
      {query.sent ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          {query.sent} sent to reception.
        </p>
      ) : null}
      {isRoomBooker(session.email) ? (
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          <Link
            href="/rooms"
            className="rounded-xl border border-[#ead8d8] bg-[var(--tint-mint)] px-4 py-3 text-[14px] font-medium text-[var(--ink)] hover:bg-[#faf4f4]"
          >
            Room booking
            <span className="mt-0.5 block text-[12px] font-normal text-[var(--muted)]">Book a meeting room</span>
          </Link>
          <Link
            href="/assign-parking"
            className="rounded-xl border border-[#ead8d8] bg-[var(--tint-mint)] px-4 py-3 text-[14px] font-medium text-[var(--ink)] hover:bg-[#faf4f4]"
          >
            Parking assign
            <span className="mt-0.5 block text-[12px] font-normal text-[var(--muted)]">Reserve a staff parking bay</span>
          </Link>
        </div>
      ) : null}

      {!canDesk && !mine.length ? (
        <Card>
          <Empty
            title="No access to this desk"
            hint="Visit requests are for HQ staff. Security uses the guard desk."
          />
        </Card>
      ) : null}

      {canDesk || mine.length ? (
      <>
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-white p-1">
        {TABS.map((item) => {
          if (item.id === "new" && !canDesk) return null;
          const href = item.id === "new" ? "/request" : `/request?tab=${item.id}`;
          const active = tab === item.id;
          const count = item.id === "history" ? mine.length : 0;
          return (
            <Link
              key={item.id}
              href={href}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] whitespace-nowrap ${
                active ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "text-[var(--muted)] hover:bg-[#faf4f4]"
              }`}
            >
              {item.label}
              {count ? (
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] ${active ? "bg-white" : "bg-[#f4eeee]"}`}>
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {tab === "new" && canDesk ? (
        <Card>
          <StaffRequestForm
            departments={departments.map((item) => ({ value: item.id, label: item.name }))}
            departmentId={session.departmentId || departments[0]?.id || ""}
            today={todayStamp()}
            people={people}
            bookerEmail={session.email}
          />
        </Card>
      ) : null}

      {tab === "history" ? (
        mine.length ? (
          <div className="space-y-3">
            {mine.map((visit) => {
              const guest = visit.visitors[0]?.visitor.fullName;
              const kind = (visit.guestKind || "GUEST") as GuestKind;
              return (
                <Link key={visit.id} href={`/request/${visit.id}`} className="block">
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold">{visit.visitCode}</span>
                        <TypeTag>{GUEST_KIND_LABEL[kind]}</TypeTag>
                        <StatusPill status={visit.status} />
                      </div>
                      <span className="text-[12px] text-[var(--muted)]">{fmtDateTime(visit.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-[13px]">{visit.purpose}</p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      {fmtDateTime(visit.expectedArrival)} · {guest || `${visit.visitorCount} guests`}
                      {visit.status === "INTAKE" ? " · With reception" : ""}
                      {visit.driverRequired ? " · Driver" : ""}
                      {visit.giftRequired ? ` · Gift${visit.giftType ? ` (${visit.giftType})` : ""}` : ""}
                      {visit.gatePassRequired ? " · Gate pass" : ""}
                      {` · ${visit.meetingRoom || "N/A"}`}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <Empty title="No requests yet" hint="Submitted visits will stay here so you can follow status." />
          </Card>
        )
      ) : null}
      </>
      ) : null}
    </div>
  );
}
