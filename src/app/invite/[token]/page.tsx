import Link from "next/link";
import { notFound } from "next/navigation";
import { GateCheckIn } from "@/components/gate-checkin";
import { NeweastLogo } from "@/components/logo";
import { QrCard } from "@/components/qr-card";
import { HQ_NAME } from "@/lib/constants";
import { requireSession } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/format";
import { canOperateGate } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { visitInclude } from "@/lib/visits";

const READY = ["APPROVED", "INVITATION_SENT", "EXPECTED", "ARRIVED", "SECURITY_VERIFICATION"];

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const visit = await prisma.visit.findUnique({
    where: { qrToken: token },
    include: visitInclude,
  });
  if (!visit) notFound();
  const visitor = visit.visitors[0]?.visitor;
  const settings = await prisma.systemSetting.findMany();
  const map = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invite/${visit.qrToken}`;
  const session = await requireSession();
  const isGate = session ? canOperateGate(session.role) : false;

  if (isGate) {
    const done = Boolean(visit.checkOutAt) || ["COMPLETED", "CHECKED_OUT"].includes(visit.status);
    if (done) {
      return (
        <div className="mx-auto min-h-full max-w-lg px-4 py-10">
          <NeweastLogo className="w-[168px]" />
          <div className="mt-6 rounded-[12px] border border-[var(--line)] bg-white p-5">
            <div className="text-[11px] font-medium tracking-[0.16em] text-[var(--brand)]">SECURITY DESK</div>
            <h1 className="mt-2 text-2xl font-medium tracking-tight">Already checked out</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {visitor?.fullName} · {visit.visitCode}
              {visit.durationMinutes != null ? ` · ${visit.durationMinutes} min` : ""}
            </p>
            <Link href={`/visits/${visit.id}`} className="mt-4 inline-flex h-10 items-center rounded-lg bg-[var(--brand)] px-4 text-[13px] font-medium text-white">
              Open visit
            </Link>
          </div>
        </div>
      );
    }
    if (visit.checkInAt) {
      if (!visit.qrCheckInRequired) {
        return (
          <ManualGate
            visitId={visit.id}
            visitCode={visit.visitCode}
            visitorName={visitor?.fullName ?? "Visitor"}
            phase="out"
            error={error}
          />
        );
      }
      return (
        <div className="mx-auto min-h-full max-w-lg px-4 py-10">
          <NeweastLogo className="w-[168px]" />
          {error ? (
            <p className="mt-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
              {error}
            </p>
          ) : null}
          <GateCheckIn
            token={visit.qrToken}
            visitCode={visit.visitCode}
            visitorName={visitor?.fullName ?? "Visitor"}
            gate="out"
          />
        </div>
      );
    }
    if (READY.includes(visit.status)) {
      if (!visit.qrCheckInRequired) {
        return (
          <ManualGate
            visitId={visit.id}
            visitCode={visit.visitCode}
            visitorName={visitor?.fullName ?? "Visitor"}
            phase="in"
            error={error}
          />
        );
      }
      return (
        <div className="mx-auto min-h-full max-w-lg px-4 py-10">
          <NeweastLogo className="w-[168px]" />
          {error ? (
            <p className="mt-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
              {error}
            </p>
          ) : null}
          <GateCheckIn
            token={visit.qrToken}
            visitCode={visit.visitCode}
            visitorName={visitor?.fullName ?? "Visitor"}
            gate="in"
          />
        </div>
      );
    }
    return (
      <div className="mx-auto min-h-full max-w-lg px-4 py-10">
        <NeweastLogo className="w-[168px]" />
        <div className="mt-6 rounded-[12px] border border-[var(--line)] bg-white p-5">
          <div className="text-[11px] font-medium tracking-[0.16em] text-[var(--brand)]">SECURITY DESK</div>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">Not ready for check-in</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {visitor?.fullName} · {visit.visitCode} · {visit.status.replaceAll("_", " ")}
          </p>
          <Link href={`/visits/${visit.id}`} className="mt-4 inline-flex h-10 items-center rounded-lg border border-[var(--line)] px-4 text-[13px] font-medium">
            Open visit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full max-w-lg px-4 py-10">
      <NeweastLogo className="w-[168px]" />
      <h1 className="mt-2 text-2xl font-medium tracking-tight">Visitor invitation</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{HQ_NAME}</p>
      {error ? (
        <p className="mt-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 rounded-[12px] border border-[var(--line)] bg-white p-5">
        <div className="text-[12px] text-[var(--muted)]">Visit reference</div>
        <div className="text-lg font-medium">{visit.visitCode}</div>
        <div className="mt-4 grid gap-3 text-[13px]">
          <Row label="Visitor" value={visitor?.fullName} />
          <Row label="Date" value={fmtDate(visit.visitDate)} />
          <Row label="Time" value={fmtTime(visit.expectedArrival)} />
          <Row label="Host" value={visit.host.name} />
          <Row label="Department" value={visit.department.name} />
          <Row label="Location" value={(visit.meetingRoom && visit.meetingRoom !== "Yes" ? visit.meetingRoom : null) || visit.location} />
          {visit.fromAbroad ? <Row label="Stay" value={`${visit.stayNights ?? "—"} night(s)`} /> : null}
          {visit.hotelRequired ? <Row label="Hotel" value={visit.hotelName} /> : null}
          {visit.pickupRequired ? <Row label="Pickup" value={[visit.pickupFrom, visit.pickupTime].filter(Boolean).join(" · ")} /> : null}
          <Row label="Gate" value={visit.qrCheckInRequired ? "Present this QR for check-in" : "Guard will record your entry"} />
        </div>
        <div className="mt-5">
          <QrCard
            value={url || visit.qrToken}
            label={visit.qrCheckInRequired ? "Present this code at the Main Gate" : "Keep this invitation with you"}
          />
        </div>
        <div className="mt-4 space-y-2 text-[13px] text-[var(--muted)]">
          <p>{map.location_instructions}</p>
          <p>{map.invite_instructions}</p>
          {visit.parkingRequired ? <p>{map.parking_instructions}</p> : null}
        </div>
      </div>
    </div>
  );
}

function ManualGate({
  visitId,
  visitCode,
  visitorName,
  phase,
  error,
}: {
  visitId: string;
  visitCode: string;
  visitorName: string;
  phase: "in" | "out";
  error?: string;
}) {
  return (
    <div className="mx-auto min-h-full max-w-lg px-4 py-10">
      <NeweastLogo className="w-[168px]" />
      {error ? (
        <p className="mt-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {error}
        </p>
      ) : null}
      <div className="mt-6 rounded-[12px] border border-[var(--line)] bg-white p-5">
        <div className="text-[11px] font-medium tracking-[0.16em] text-[var(--brand)]">SECURITY DESK</div>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">Manual {phase === "out" ? "check-out" : "check-in"}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {visitorName} · {visitCode}
        </p>
        <p className="mt-3 text-sm text-[var(--ink)]">
          This visit does not use a QR scan. Record {phase === "out" ? "exit" : "entry"} on the visit page.
        </p>
        <Link href={`/visits/${visitId}`} className="mt-4 inline-flex h-10 items-center rounded-lg bg-[var(--brand)] px-4 text-[13px] font-medium text-white">
          Open visit and record {phase === "out" ? "check-out" : "check-in"}
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--faint)]">{label}</span>
      <span className="text-right font-medium text-[var(--ink)]">{value || "—"}</span>
    </div>
  );
}
