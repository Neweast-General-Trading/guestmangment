"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { TYPE_COLOR } from "@/lib/hospitality";
import { STATUS_LABEL, type VisitStatus } from "@/lib/constants";

export type CalendarVisit = {
  id: string;
  visitCode: string;
  name: string;
  type: string;
  status: string;
  date: string;
  time: string;
  fromAbroad: boolean;
  hotelRequired: boolean;
  pickupRequired: boolean;
};

export function VisitCalendar({ visits }: { visits: CalendarVisit[] }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarVisit[]>();
    for (const visit of visits) {
      const key = visit.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), visit]);
    }
    return map;
  }, [visits]);

  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : "";
  const selectedVisits = byDay.get(selectedKey) ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="rounded-[10px] border border-[var(--line)] bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="h-8 rounded-md px-2 text-[13px] hover:bg-[var(--brand-soft)]" onClick={() => setCursor(subMonths(cursor, 1))}>
            Previous
          </button>
          <div className="text-sm font-medium">{format(cursor, "MMMM yyyy")}</div>
          <button type="button" className="h-8 rounded-md px-2 text-[13px] hover:bg-[var(--brand-soft)]" onClick={() => setCursor(addMonths(cursor, 1))}>
            Next
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--faint)]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-[var(--line)]">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const outside = !isSameMonth(day, cursor);
            const isToday = isSameDay(day, new Date());
            const isSelected = selected && isSameDay(day, selected);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(day)}
                className={`cal-day text-left ${outside ? "muted" : ""} ${isToday ? "today" : ""} ${isSelected ? "bg-[var(--brand-soft)]" : ""}`}
              >
                <div className="mb-1 text-[12px]">{format(day, "d")}</div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                      style={{ background: TYPE_COLOR[item.type] ?? "#64748b" }}
                    >
                      {item.time} {item.name.split(" ")[0]}
                    </div>
                  ))}
                  {items.length > 3 ? <div className="text-[10px] text-[var(--muted)]">+{items.length - 3}</div> : null}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              {type.replaceAll("_", " ").toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-[10px] border border-[var(--line)] bg-white p-4">
        <div className="text-sm font-medium">{selected ? format(selected, "EEEE d MMM") : "Select a day"}</div>
        <div className="mt-3 space-y-2">
          {selectedVisits.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">No visits on this day.</p>
          ) : (
            selectedVisits.map((item) => (
              <Link key={item.id} href={`/visits/${item.id}`} className="block rounded-lg border border-[var(--line)] p-3 hover:border-[var(--brand)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{item.name}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[item.type] }} />
                </div>
                <div className="mt-1 text-[12px] text-[var(--muted)]">
                  {item.time} · {item.visitCode} · {STATUS_LABEL[item.status as VisitStatus] ?? item.status}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.fromAbroad ? <span className="need-pill bg-[var(--brand-soft)] text-[var(--brand-ink)]">From abroad</span> : null}
                  {item.hotelRequired ? <span className="need-pill bg-[#e8f1f8] text-[#1d4f7a]">Hotel</span> : null}
                  {item.pickupRequired ? <span className="need-pill bg-[#f8f1de] text-[#9a6b12]">Pickup</span> : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
