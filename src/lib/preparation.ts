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

export function preparationLabel(visit: PreparationVisit) {
  if (visit.status !== "INTAKE" && visit.status !== "EXPECTED") return undefined;
  if (preparationReady(visit)) return "Ready";
  if (visit.roomConfirmRepliedAt || visit.calendarInvitedAt) return "Meeting room confirmed";
  return "Preparing";
}
