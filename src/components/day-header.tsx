import type { DayGroup } from "@/lib/visit-order";

const TONE: Record<DayGroup<unknown>["tone"], { bar: string; text: string; chip: string; dot: string }> = {
  now: { bar: "bg-[var(--brand-soft)] border-[var(--brand)]", text: "text-[var(--brand-ink)]", chip: "bg-white text-[var(--brand-ink)]", dot: "bg-[var(--brand)] animate-pulse" },
  today: { bar: "bg-[var(--info-bg)] border-[var(--info)]", text: "text-[var(--info)]", chip: "bg-white text-[var(--info)]", dot: "bg-[var(--info)]" },
  ahead: { bar: "bg-[var(--tint-sky)] border-[var(--line-strong)]", text: "text-[var(--ink)]", chip: "bg-white text-[var(--muted)]", dot: "bg-[var(--line-strong)]" },
  past: { bar: "bg-[#f4f2f2] border-[var(--line)]", text: "text-[var(--muted)]", chip: "bg-white text-[var(--faint)]", dot: "bg-[var(--faint)]" },
};

/** Day divider used by every visit list: tells reception where "now", today, and the past begin. */
export function DayHeader({ group }: { group: Pick<DayGroup<unknown>, "label" | "hint" | "tone"> & { count: number } }) {
  const tone = TONE[group.tone];
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border-l-4 px-3 py-2 ${tone.bar}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
        <span className={`truncate text-[13px] font-semibold ${tone.text}`}>{group.label}</span>
        <span className="hidden text-[12px] text-[var(--muted)] sm:inline">· {group.hint}</span>
      </div>
      <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${tone.chip}`}>
        {group.count}
      </span>
    </div>
  );
}

/** Small pill with the visit's relative time ("Now", "in 45 min", "in 2 days"). */
export function WhenChip({ label, tone }: { label: string; tone: DayGroup<unknown>["tone"] }) {
  if (!label) return null;
  const style =
    label === "Now"
      ? "bg-[var(--brand)] text-white"
      : tone === "today"
        ? "bg-[var(--info-bg)] text-[var(--info)]"
        : tone === "past"
          ? "bg-[#f1f2f4] text-[#5f6672]"
          : "bg-[var(--tint-sky)] text-[var(--muted)]";
  return <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold whitespace-nowrap ${style}`}>{label}</span>;
}

const CARD: Record<DayGroup<unknown>["tone"], { box: string; title: string; chip: string; dot: string }> = {
  now: { box: "border-[var(--brand)] bg-[var(--brand-soft)]", title: "text-[var(--brand-ink)]", chip: "bg-[var(--brand)] text-white", dot: "bg-[var(--brand)] animate-pulse" },
  today: { box: "border-[var(--info)] bg-[var(--info-bg)]", title: "text-[var(--info)]", chip: "bg-white text-[var(--info)]", dot: "bg-[var(--info)]" },
  ahead: { box: "border-[var(--line-strong)] bg-white", title: "text-[var(--ink)]", chip: "bg-[var(--tint-sky)] text-[var(--muted)]", dot: "bg-[var(--line-strong)]" },
  past: { box: "border-[var(--line)] bg-[#faf9f9]", title: "text-[var(--muted)]", chip: "bg-white text-[var(--faint)]", dot: "bg-[var(--faint)]" },
};

/**
 * A day (or "Happening now") as one compact card: title, count and a one-line preview of each meeting.
 * Click to open it and see the full meeting cards inside. Plain <details>, so it works without JavaScript.
 */
export function DayGroupCard({
  group,
  preview,
  children,
  defaultOpen = false,
}: {
  group: Pick<DayGroup<unknown>, "label" | "hint" | "tone"> & { count: number };
  preview: { id: string; time: string; title: string; room: string; now?: boolean }[];
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const tone = CARD[group.tone];
  const shown = preview.slice(0, 4);
  const more = preview.length - shown.length;
  return (
    <details className={`group rounded-xl border ${tone.box}`} open={defaultOpen}>
      <summary className="cursor-pointer list-none rounded-xl px-4 py-3 hover:brightness-[.98] [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
            <span className={`truncate text-[15px] font-semibold ${tone.title}`}>{group.label}</span>
            <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[12px] font-semibold ${tone.chip}`}>
              {group.count} {group.count === 1 ? "meeting" : "meetings"}
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-[var(--muted)]">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-180" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5 group-open:hidden">
          {shown.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-[12px]"
            >
              <span className={`font-semibold tabular-nums ${item.now ? "text-[var(--brand)]" : "text-[var(--ink)]"}`}>{item.time}</span>
              <span className="truncate text-[var(--ink)]">{item.title}</span>
              <span className="shrink-0 text-[var(--muted)]">· {item.room}</span>
            </li>
          ))}
          {more > 0 ? <li className="rounded-lg px-2 py-1 text-[12px] text-[var(--muted)]">+{more} more</li> : null}
        </ul>
      </summary>
      <div className="space-y-3 px-3 pb-3">{children}</div>
    </details>
  );
}
