import { format, isToday, isTomorrow, isYesterday, startOfDay } from "date-fns";

/**
 * One rule for every visit list: what is happening now and coming next sits on top, in time order;
 * what is over sits below it, newest first. Lists are grouped by day so reception can see where today ends.
 */

const CLOSED = new Set(["CHECKED_OUT", "COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW", "EXPIRED", "ACCESS_DENIED", "PASSED"]);

type Timed = {
  status: string;
  expectedArrival: Date | string;
  expectedDeparture?: Date | string | null;
};

export function visitStart(visit: Timed) {
  return new Date(visit.expectedArrival);
}

export function visitEnd(visit: Timed) {
  const start = visitStart(visit);
  const end = visit.expectedDeparture ? new Date(visit.expectedDeparture) : null;
  return end && end > start ? end : new Date(start.getTime() + 60 * 60 * 1000);
}

/** Still ahead or under way, and not closed. */
export function isLive(visit: Timed, now: number) {
  return !CLOSED.has(visit.status) && visitEnd(visit).getTime() >= now;
}

export function isHappeningNow(visit: Timed, now: number) {
  return isLive(visit, now) && visitStart(visit).getTime() <= now;
}

export function upcomingFirst<T extends Timed>(visits: T[], now: number) {
  const live = visits.filter((v) => isLive(v, now)).sort((a, b) => visitStart(a).getTime() - visitStart(b).getTime());
  const over = visits.filter((v) => !isLive(v, now)).sort((a, b) => visitStart(b).getTime() - visitStart(a).getTime());
  return [...live, ...over];
}

export type DayGroup<T> = { key: string; label: string; hint: string; tone: "now" | "today" | "ahead" | "past"; items: T[] };

function dayLabel(date: Date) {
  if (isToday(date)) return `Today · ${format(date, "EEE dd MMM")}`;
  if (isTomorrow(date)) return `Tomorrow · ${format(date, "EEE dd MMM")}`;
  if (isYesterday(date)) return `Yesterday · ${format(date, "EEE dd MMM")}`;
  return format(date, "EEEE dd MMM yyyy");
}

/** Groups an already ordered list: "Happening now", then one group per day. */
export function groupByDay<T extends Timed>(visits: T[], now: number): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  const today = startOfDay(new Date(now)).getTime();
  for (const visit of visits) {
    const start = visitStart(visit);
    const happening = isHappeningNow(visit, now);
    const key = happening ? "now" : `${isLive(visit, now) ? "live" : "past"}:${format(start, "yyyy-MM-dd")}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const day = startOfDay(start).getTime();
      const tone: DayGroup<T>["tone"] = happening ? "now" : !isLive(visit, now) ? "past" : day === today ? "today" : "ahead";
      group = {
        key,
        label: happening ? "Happening now" : dayLabel(start),
        hint: happening ? "Started and not finished yet" : tone === "past" ? "Finished" : tone === "today" ? "Later today" : "Coming up",
        tone,
        items: [],
      };
      groups.push(group);
    }
    group.items.push(visit);
  }
  return groups;
}

/** Short relative time for a card: "Now", "in 45 min", "in 3 h", "Ended". */
export function relativeWhen(visit: Timed, now: number) {
  if (!isLive(visit, now)) return CLOSED.has(visit.status) ? "" : "Ended";
  const start = visitStart(visit).getTime();
  if (start <= now) return "Now";
  const minutes = Math.round((start - now) / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round((startOfDay(new Date(start)).getTime() - startOfDay(new Date(now)).getTime()) / 86_400_000);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** The request's clock, read once per page render and passed down so server and browser agree. */
export function requestNow() {
  return Date.now();
}
