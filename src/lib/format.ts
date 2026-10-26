import { format, formatDistanceStrict, isToday, isTomorrow, isYesterday } from "date-fns";
import { STATUS_LABEL, VISIT_TYPE_LABEL, type VisitStatus, type VisitType } from "./constants";

export function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy");
}

export function fmtTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "HH:mm");
}

export function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy · HH:mm");
}

export function fmtDayLabel(value: Date | string) {
  const date = new Date(value);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, dd MMM");
}

export function fmtDuration(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function liveDuration(checkInAt: Date | string | null | undefined) {
  if (!checkInAt) return "—";
  return formatDistanceStrict(new Date(checkInAt), new Date());
}

export function statusLabel(status: string) {
  return STATUS_LABEL[status as VisitStatus] ?? status;
}

export function typeLabel(type: string) {
  return VISIT_TYPE_LABEL[type as VisitType] ?? type;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function maskId(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}
