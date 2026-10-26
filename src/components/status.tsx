import { STATUS_LABEL, type VisitStatus } from "@/lib/constants";
import { TYPE_COLOR } from "@/lib/hospitality";

const TONE: Record<string, string> = {
  DRAFT: "bg-[#f1f2f4] text-[#5f6672]",
  INTAKE: "bg-[#e8f1f8] text-[#1d4f7a]",
  MANAGER_REVIEW: "bg-[#f8f1de] text-[#9a6b12]",
  ESCALATED: "bg-[#f8f1de] text-[#9a6b12]",
  PENDING_APPROVAL: "bg-[#f8f1de] text-[#9a6b12]",
  APPROVED: "bg-[#e8f6ee] text-[#1f7a4d]",
  INVITATION_SENT: "bg-[#e8f1f8] text-[#1d4f7a]",
  EXPECTED: "bg-[#e8f1f8] text-[#1d4f7a]",
  ARRIVED: "bg-[#e8f1f8] text-[#1d4f7a]",
  WAITING_AT_GATE: "bg-[#f8f1de] text-[#9a6b12]",
  SECURITY_VERIFICATION: "bg-[#e8f1f8] text-[#1d4f7a]",
  CHECKED_IN: "bg-[#e8f6ee] text-[#1f7a4d]",
  CURRENTLY_INSIDE: "bg-[#e8f6ee] text-[#1f7a4d]",
  IN_MEETING: "bg-[#e8f6ee] text-[#1f7a4d]",
  OVERDUE: "bg-[#fdecea] text-[#b42318]",
  CHECKED_OUT: "bg-[#f1f2f4] text-[#5f6672]",
  COMPLETED: "bg-[#f1f2f4] text-[#5f6672]",
  REJECTED: "bg-[#fdecea] text-[#b42318]",
  CANCELLED: "bg-[#f1f2f4] text-[#5f6672]",
  NO_SHOW: "bg-[#f8f1de] text-[#9a6b12]",
  EXPIRED: "bg-[#f1f2f4] text-[#5f6672]",
  ACCESS_DENIED: "bg-[#fdecea] text-[#b42318]",
  PENDING: "bg-[#f8f1de] text-[#9a6b12]",
  WAITING: "bg-[#f1f2f4] text-[#5f6672]",
  INFO_REQUESTED: "bg-[#f8f1de] text-[#9a6b12]",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap ${TONE[status] ?? "bg-[#f1f2f4] text-[#5f6672]"}`}>
      {STATUS_LABEL[status as VisitStatus] ?? status}
    </span>
  );
}

export function TypeTag({ children, type }: { children: string; type?: string }) {
  const color = type ? TYPE_COLOR[type] : undefined;
  return (
    <span
      className="inline-flex h-6 items-center rounded-md px-2 text-[11px] font-medium"
      style={
        color
          ? { background: `${color}18`, color }
          : { background: "#f3f4f6", color: "var(--muted)" }
      }
    >
      {children}
    </span>
  );
}
