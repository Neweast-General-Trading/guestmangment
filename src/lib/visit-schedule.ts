function dubaiParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    time: `${pick("hour")}:${pick("minute")}`,
  };
}

export function combineVisitDateTime(date: string, time?: string) {
  if (time && time.includes("T")) {
    if (/Z$|[+-]\d{2}:\d{2}$/.test(time)) return new Date(time);
    return new Date(`${time}+04:00`);
  }
  const clock = time || "09:00";
  const stamped = clock.length === 5 ? `${clock}:00` : clock;
  return new Date(`${date}T${stamped}+04:00`);
}

export function todayStamp(now = new Date()) {
  return dubaiParts(now).date;
}

export function timeStamp(now = new Date()) {
  return dubaiParts(now).time;
}

export function isPastVisitSchedule(date: string, time?: string, now = Date.now()) {
  const arrival = combineVisitDateTime(date, time);
  return Number.isNaN(arrival.getTime()) || arrival.getTime() < now - 30_000;
}

export function assertFutureVisit(date: string, time?: string) {
  if (isPastVisitSchedule(date, time)) {
    throw new Error("Visit date and time cannot be in the past.");
  }
}

export function datetimeLocal(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${todayStamp(date)}T${timeStamp(date)}`;
}

export function defaultArrivalTime(date: string, now = new Date()) {
  if (date > todayStamp(now)) return "09:30";
  const current = timeStamp(now);
  return current > "09:30" ? current : "09:30";
}
