import { parseTourType } from "./constants";

type PersonPrep = {
  visitor?: { fullName?: string | null };
  gatePassRequired?: boolean | null;
  gatePassStatus?: string | null;
  giftRequired?: boolean | null;
  giftStatus?: string | null;
};

export type PreparationVisit = {
  status: string;
  meetingRoom?: string | null;
  driverRequired?: boolean | null;
  driverStatus?: string | null;
  gatePassRequired?: boolean | null;
  gatePassStatus?: string | null;
  giftRequired?: boolean | null;
  giftStatus?: string | null;
  tourType?: string | null;
  tourStatus?: string | null;
  calendarInvitedAt?: Date | string | null;
  roomConfirmRepliedAt?: Date | string | null;
  visitors?: PersonPrep[];
};

function roomReady(visit: PreparationVisit) {
  const room = (visit.meetingRoom || "").trim();
  return Boolean(room) && !/^n\/?a$/i.test(room) && room !== "Yes";
}

function listReady(
  people: PersonPrep[] | undefined,
  personRequired: (person: PersonPrep) => boolean | null | undefined,
  personStatus: (person: PersonPrep) => string | null | undefined,
  required: boolean | null | undefined,
  status: string | null | undefined,
) {
  const marked = (people || []).filter((person) => personRequired(person));
  if (marked.length) return marked.every((person) => personStatus(person) === "DONE");
  return !required || status === "DONE";
}

export function preparationReady(visit: PreparationVisit) {
  if (parseTourType(visit.tourType) === "BUILDING" && visit.tourStatus !== "APPROVED") return false;
  if (!roomReady(visit)) return false;
  if (visit.driverRequired && visit.driverStatus !== "DONE") return false;
  if (!listReady(visit.visitors, (person) => person.gatePassRequired, (person) => person.gatePassStatus, visit.gatePassRequired, visit.gatePassStatus)) return false;
  if (!listReady(visit.visitors, (person) => person.giftRequired, (person) => person.giftStatus, visit.giftRequired, visit.giftStatus)) return false;
  if (Array.isArray(visit.visitors) && visit.visitors.length === 0) return false;
  return true;
}

export function preparationGaps(visit: PreparationVisit) {
  if (preparationReady(visit)) return [];
  const waiting: string[] = [];
  if (!roomReady(visit)) waiting.push("Meeting room");
  if (parseTourType(visit.tourType) === "BUILDING" && visit.tourStatus !== "APPROVED") waiting.push("Building tour");
  if (visit.driverRequired && visit.driverStatus !== "DONE") waiting.push("Driver");
  if (!listReady(visit.visitors, (person) => person.gatePassRequired, (person) => person.gatePassStatus, visit.gatePassRequired, visit.gatePassStatus)) {
    waiting.push("Gate pass");
  }
  if (!listReady(visit.visitors, (person) => person.giftRequired, (person) => person.giftStatus, visit.giftRequired, visit.giftStatus)) {
    waiting.push("Gift");
  }
  return waiting;
}

export function preparationWaiting(visit: PreparationVisit) {
  if (visit.status !== "INTAKE") return [];
  return preparationGaps(visit);
}

export function preparationNote(visit: PreparationVisit) {
  const waiting = preparationWaiting(visit);
  return waiting.length ? `Waiting on ${waiting.join(", ")}` : "";
}

const GAP_OWNER: Record<string, string> = {
  "Meeting room": "Reception",
  Driver: "Sachini",
  "Gate pass": "Muna",
  Gift: "Jesman",
  "Building tour": "Salma Moufallah",
};

function gapPhrase(gap: string) {
  if (gap === "Meeting room") return "no meeting room was chosen";
  if (gap === "Driver") return "the driver is not confirmed";
  if (gap === "Gate pass") return "the gate pass is not uploaded";
  if (gap === "Gift") return "the gift is not ready";
  if (gap === "Building tour") return "the building tour is not approved";
  return gap;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function pendingBecause(visit: PreparationVisit, hold: "unbooked" | "awaiting-accept") {
  const room = (visit.meetingRoom || "").trim();
  const roomMissing = !roomReady(visit);
  const extra = preparationGaps(visit).filter((gap) => gap !== "Meeting room");
  const reasons: string[] = [];
  const who: string[] = [];
  if (roomMissing) {
    reasons.push(gapPhrase("Meeting room"));
    who.push("Reception");
  } else if (hold === "unbooked") {
    reasons.push(`${room} is not booked yet`);
    who.push("Reception");
  } else {
    reasons.push(`${room} has not accepted`);
    who.push(room);
  }
  for (const gap of extra) {
    reasons.push(gapPhrase(gap));
    const owner = GAP_OWNER[gap];
    if (owner && !who.includes(owner)) who.push(owner);
  }
  return `Pending because ${joinList(reasons)}. Waiting on ${joinList(who)}.`;
}

export function preparationLabel(visit: PreparationVisit) {
  if (visit.status !== "INTAKE" && visit.status !== "EXPECTED") return undefined;
  if (preparationReady(visit)) return "Ready";
  if (visit.roomConfirmRepliedAt || visit.calendarInvitedAt) return "Meeting room confirmed";
  return "Preparing";
}
