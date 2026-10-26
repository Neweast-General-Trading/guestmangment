export const GUEST_NEED_PAGE_SIZE = 8;

export const NEED_CATEGORIES = [
  { code: "all", label: "All" },
  { code: "stay", label: "Stay" },
  { code: "transport", label: "Transport" },
  { code: "meals", label: "Meals" },
  { code: "workplace", label: "Workplace" },
  { code: "protocol", label: "Protocol" },
  { code: "other", label: "Other" },
] as const;

export type NeedCategory = Exclude<(typeof NEED_CATEGORIES)[number]["code"], "all">;

export type NeedFlag = "hotel" | "pickup" | "dropoff" | "breakfast" | "lunch" | "dinner" | "parking";

export type GuestNeedDef = {
  code: string;
  label: string;
  hint: string;
  category: NeedCategory;
  maps?: NeedFlag;
};

export type SelectedNeed = { code: string; notes: string };

export const GUEST_NEEDS: GuestNeedDef[] = [
  { code: "FROM_ABROAD", label: "Arriving from abroad", hint: "Travel from another country", category: "stay" },
  { code: "FLIGHT_TICKET", label: "Flight ticket", hint: "Arrange flights", category: "stay" },
  { code: "HOTEL", label: "Hotel booking", hint: "Book accommodation", category: "stay", maps: "hotel" },
  { code: "EXTRA_NIGHTS", label: "Extra hotel nights", hint: "Longer stay", category: "stay" },
  { code: "LATE_HOTEL", label: "Late hotel check-in", hint: "Late arrival to the hotel", category: "stay" },
  { code: "EARLY_HOTEL", label: "Early hotel check-out", hint: "Leave the hotel early", category: "stay" },
  { code: "HOTEL_UPGRADE", label: "Room upgrade", hint: "Higher room category", category: "stay" },
  { code: "AIRPORT_PICKUP", label: "Airport pickup", hint: "Collect from the airport", category: "transport", maps: "pickup" },
  { code: "AIRPORT_WAIT", label: "Airport wait", hint: "Wait at arrivals", category: "transport", maps: "pickup" },
  { code: "AIRPORT_DROPOFF", label: "Airport drop-off", hint: "Return to the airport", category: "transport", maps: "dropoff" },
  { code: "HQ_CAR", label: "Car for the day", hint: "Vehicle during the visit", category: "transport" },
  { code: "DRIVER", label: "Driver", hint: "A driver for the guest", category: "transport" },
  { code: "TAXI", label: "Taxi / transfer", hint: "Booked road transfer", category: "transport" },
  { code: "PARKING", label: "Visitor parking", hint: "Parking space", category: "transport", maps: "parking" },
  { code: "INTERCITY", label: "Intercity travel", hint: "Travel between cities", category: "transport" },
  { code: "BREAKFAST", label: "Breakfast", hint: "Morning meal", category: "meals", maps: "breakfast" },
  { code: "LUNCH", label: "Lunch", hint: "Midday meal", category: "meals", maps: "lunch" },
  { code: "DINNER", label: "Dinner", hint: "Evening meal", category: "meals", maps: "dinner" },
  { code: "COFFEE", label: "Coffee service", hint: "Coffee and tea", category: "meals" },
  { code: "CATERING", label: "Meeting catering", hint: "Food for the meeting", category: "meals" },
  { code: "DIETARY", label: "Dietary needs", hint: "Food restrictions", category: "meals" },
  { code: "MEETING_SETUP", label: "Meeting room setup", hint: "Prepare the room", category: "workplace" },
  { code: "PROJECTOR", label: "Screen / projector", hint: "Display for presenting", category: "workplace" },
  { code: "VIDEOCALL", label: "Video conference", hint: "Online meeting", category: "workplace" },
  { code: "WIFI", label: "Guest Wi-Fi", hint: "Network access", category: "workplace" },
  { code: "WORKSTATION", label: "Desk / workstation", hint: "A place to work", category: "workplace" },
  { code: "PRINTING", label: "Printing / copies", hint: "Print documents", category: "workplace" },
  { code: "INTERPRETER", label: "Interpreter", hint: "Live translation", category: "workplace" },
  { code: "DOCS_TRANSLATION", label: "Document translation", hint: "Written translation", category: "workplace" },
  { code: "WORKSHOP_KIT", label: "Workshop materials", hint: "Workshop supplies", category: "workplace" },
  { code: "VIP_PROTOCOL", label: "VIP protocol", hint: "Formal reception", category: "protocol" },
  { code: "GREETING", label: "Reception greeting", hint: "Meet on arrival", category: "protocol" },
  { code: "ESCORT", label: "Escort", hint: "Accompany inside", category: "protocol" },
  { code: "SECURITY_ESCORT", label: "Security escort", hint: "Security accompaniment", category: "protocol" },
  { code: "BADGE_ADVANCE", label: "Badge in advance", hint: "Prepare visitor badge", category: "protocol" },
  { code: "FLAGS", label: "Flags / branding", hint: "Display flags or branding", category: "protocol" },
  { code: "GIFT", label: "Protocol gift", hint: "Welcome gift", category: "protocol" },
  { code: "HQ_TOUR", label: "Site tour", hint: "Short tour of the offices", category: "protocol" },
  { code: "PHOTOGRAPHY", label: "Photography", hint: "Photos during the visit", category: "protocol" },
  { code: "SIM", label: "Local SIM / eSIM", hint: "Local mobile data", category: "other" },
  { code: "VISA_HELP", label: "Visa assistance", hint: "Entry or invitation support", category: "other" },
  { code: "LUGGAGE", label: "Luggage storage", hint: "Store bags", category: "other" },
  { code: "PRAYER", label: "Prayer room", hint: "Quiet prayer space", category: "other" },
  { code: "MEDICAL", label: "Medical support", hint: "First aid if needed", category: "other" },
  { code: "ACCESSIBILITY", label: "Accessibility", hint: "Access support", category: "other" },
  { code: "FAMILY", label: "Family accompanying", hint: "Family travelling along", category: "other" },
  { code: "CHILDCARE", label: "Childcare", hint: "Children present", category: "other" },
];

export const NEED_BY_CODE = Object.fromEntries(GUEST_NEEDS.map((item) => [item.code, item]));

const CODE_RE = /^[A-Z][A-Z0-9_]{1,39}$/;

export function parseGuestNeeds(json?: string | null): SelectedNeed[] {
  if (!json?.trim()) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: SelectedNeed[] = [];
    for (const item of raw) {
      let code = "";
      let notes = "";
      if (typeof item === "string") code = item;
      else if (item && typeof item === "object") {
        code = String((item as { code?: string }).code || "");
        notes = String((item as { notes?: string }).notes || "").slice(0, 240);
      }
      if (!CODE_RE.test(code) || seen.has(code)) continue;
      seen.add(code);
      out.push({ code, notes });
    }
    return out;
  } catch {
    return [];
  }
}

export function stringifyGuestNeeds(items: SelectedNeed[]) {
  return JSON.stringify(
    items
      .filter((item) => CODE_RE.test(item.code))
      .map((item) => ({ code: item.code, notes: item.notes.trim() })),
  );
}

export function flagsFromNeeds(items: SelectedNeed[]) {
  const codes = new Set(items.map((item) => item.code));
  return {
    hotelRequired: codes.has("HOTEL") || codes.has("EXTRA_NIGHTS") || codes.has("HOTEL_UPGRADE"),
    pickupRequired: codes.has("AIRPORT_PICKUP") || codes.has("AIRPORT_WAIT") || codes.has("HQ_CAR") || codes.has("DRIVER"),
    dropoffRequired: codes.has("AIRPORT_DROPOFF"),
    fromAbroad: codes.has("FROM_ABROAD"),
    mealBreakfast: codes.has("BREAKFAST"),
    mealLunch: codes.has("LUNCH"),
    mealDinner: codes.has("DINNER"),
    parkingRequired: codes.has("PARKING"),
  };
}

export function filterNeeds(items: GuestNeedDef[], query: string, category: string) {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (!q) return true;
    return `${item.label} ${item.hint} ${item.code}`.toLowerCase().includes(q);
  });
}

export function pageItems<T>(items: T[], page: number, size = GUEST_NEED_PAGE_SIZE) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size) || 1);
  const current = Math.min(pages, Math.max(1, page || 1));
  const start = (current - 1) * size;
  return {
    slice: items.slice(start, start + size),
    page: current,
    pages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(total, start + size),
  };
}

export function selectedFromVisit(visit: {
  guestNeedsJson?: string | null;
  fromAbroad?: boolean;
  hotelRequired: boolean;
  hotelName?: string | null;
  pickupRequired: boolean;
  pickupFrom?: string | null;
  dropoffRequired: boolean;
  mealBreakfast: boolean;
  mealLunch: boolean;
  mealDinner: boolean;
  parkingRequired: boolean;
  dietaryNeeds?: string | null;
}) {
  const stored = parseGuestNeeds(visit.guestNeedsJson);
  if (stored.length) return stored;
  const inferred: SelectedNeed[] = [];
  if (visit.fromAbroad) inferred.push({ code: "FROM_ABROAD", notes: "" });
  if (visit.hotelRequired) inferred.push({ code: "HOTEL", notes: visit.hotelName || "" });
  if (visit.pickupRequired) inferred.push({ code: "AIRPORT_PICKUP", notes: visit.pickupFrom || "" });
  if (visit.dropoffRequired) inferred.push({ code: "AIRPORT_DROPOFF", notes: "" });
  if (visit.mealBreakfast) inferred.push({ code: "BREAKFAST", notes: "" });
  if (visit.mealLunch) inferred.push({ code: "LUNCH", notes: "" });
  if (visit.mealDinner) inferred.push({ code: "DINNER", notes: "" });
  if (visit.parkingRequired) inferred.push({ code: "PARKING", notes: "" });
  if (visit.dietaryNeeds) inferred.push({ code: "DIETARY", notes: visit.dietaryNeeds });
  return inferred;
}

export function needLabel(code: string) {
  return NEED_BY_CODE[code]?.label || code;
}

export function checkInModeLabel(qrRequired: boolean) {
  return qrRequired ? "QR check-in" : "Manual check-in";
}
