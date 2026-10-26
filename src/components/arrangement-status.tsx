import { ARRANGEMENT_LABEL } from "@/lib/arrangement-types";

const TONE: Record<string, string> = {
  PENDING: "bg-[#f8f1de] text-[#9a6b12]",
  PREPARING: "bg-[#e8f1f8] text-[#1d4f7a]",
  DONE: "bg-[#e8f6ee] text-[#1f7a4d]",
};

export function ArrangementPill({ status }: { status?: string | null }) {
  const value = status || "PENDING";
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap ${TONE[value] ?? "bg-[#f1f2f4] text-[#5f6672]"}`}>
      {ARRANGEMENT_LABEL[value] || value}
    </span>
  );
}
