import Link from "next/link";
import { endOfDay, startOfDay } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  DoorOpen,
  Hourglass,
  LogOut,
  Search,
  UserCheck,
  XCircle,
} from "lucide-react";
import { QrCheckInStation } from "@/components/qr-checkin-station";
import { SecurityQueue } from "@/components/paged-tables";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visitInclude } from "@/lib/visits";

const QUEUES = [
  { key: "desk", label: "On the desk", statuses: ["EXPECTED"], Icon: CalendarClock },
  { key: "expected", label: "Expected today", statuses: ["APPROVED", "INVITATION_SENT", "EXPECTED"], Icon: CalendarClock },
  { key: "soon", label: "Arriving soon", statuses: ["EXPECTED", "INVITATION_SENT"], Icon: Clock },
  { key: "waiting", label: "Waiting at gate", statuses: ["WAITING_AT_GATE", "ARRIVED"], Icon: DoorOpen },
  { key: "pending", label: "Pending approval", statuses: ["PENDING_APPROVAL"], Icon: Hourglass },
  { key: "approved", label: "Approved", statuses: ["APPROVED"], Icon: Check },
  { key: "inside", label: "Currently inside", statuses: ["CHECKED_IN", "CURRENTLY_INSIDE", "IN_MEETING"], Icon: UserCheck },
  { key: "overdue", label: "Overdue", statuses: ["OVERDUE"], Icon: AlertTriangle },
  { key: "out", label: "Checked-out", statuses: ["CHECKED_OUT", "COMPLETED"], Icon: LogOut },
  { key: "denied", label: "Rejected / denied", statuses: ["REJECTED", "ACCESS_DENIED"], Icon: XCircle },
] as const;

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; queue?: string; error?: string }>;
}) {
  await requireSession();
  const { q, queue = "expected", error } = await searchParams;
  const selected = QUEUES.find((item) => item.key === queue) ?? QUEUES[0];
  const today = { gte: startOfDay(new Date()), lte: endOfDay(new Date()) };

  const queueWhere = (key: string, statuses: readonly string[]) => ({
    status: { in: [...statuses] },
    ...(key === "out"
      ? { checkOutAt: today }
      : key === "inside" || key === "overdue" || key === "desk"
        ? {}
        : { visitDate: today }),
  });

  const counts = Object.fromEntries(
    await Promise.all(
      QUEUES.map(async (item) => [
        item.key,
        await prisma.visit.count({ where: queueWhere(item.key, item.statuses) }),
      ]),
    ),
  ) as Record<string, number>;

  const visits = await prisma.visit.findMany({
    where: q
      ? {
          OR: [
            { visitCode: { contains: q } },
            { qrToken: { contains: q } },
            { host: { name: { contains: q } } },
            { department: { name: { contains: q } } },
            { visitors: { some: { visitor: { fullName: { contains: q } } } } },
            { visitors: { some: { visitor: { mobile: { contains: q } } } } },
            { visitors: { some: { visitor: { company: { contains: q } } } } },
          ],
        }
      : {
          ...queueWhere(selected.key, selected.statuses),
        },
    include: visitInclude,
    orderBy: { expectedArrival: "asc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="Security desk"
        description="Scan the invitation QR to check a visitor in or out."
        actions={
          <div className="flex flex-wrap gap-2 text-[12px]">
            <Link href="/walk-in" className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-white px-2.5 text-[var(--muted)] hover:text-[var(--ink)]">
              Walk-in
            </Link>
            <Link href="/inside" className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-white px-2.5 text-[var(--muted)] hover:text-[var(--ink)]">
              Inside
            </Link>
            <Link href="/badges" className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-white px-2.5 text-[var(--muted)] hover:text-[var(--ink)]">
              Badges
            </Link>
            <Link href="/parking" className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-white px-2.5 text-[var(--muted)] hover:text-[var(--ink)]">
              Parking
            </Link>
          </div>
        }
      />
      {error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {error}
        </p>
      ) : null}
      <QrCheckInStation />
      <form className="mb-4">
        <label className="relative block">
          <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search visitor, mobile, company, visit ID, host, department, or QR token"
            className="h-11 w-full rounded-md border border-[var(--line)] bg-white pl-10 pr-4 text-[14px] outline-none focus:border-[var(--brand)]"
          />
        </label>
      </form>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {QUEUES.map((item) => {
          const on = item.key === selected.key;
          return (
            <Link
              key={item.key}
              href={`/security?queue=${item.key}`}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] ${
                on
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]"
                  : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#faf4f4]"
              }`}
            >
              <item.Icon size={14} strokeWidth={1.75} />
              {item.label}
              <span className={on ? "text-[var(--brand)]" : "text-[var(--faint)]"}>{counts[item.key] ?? 0}</span>
            </Link>
          );
        })}
      </div>
      <SecurityQueue visits={visits} />
    </div>
  );
}
