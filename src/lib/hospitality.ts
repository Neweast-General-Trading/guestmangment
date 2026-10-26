import { flagsFromNeeds, parseGuestNeeds, stringifyGuestNeeds } from "@/lib/guest-needs";

export const HOTEL_STATUSES = [
  { code: "REQUESTED", label: "Requested" },
  { code: "CONFIRMED", label: "Confirmed" },
  { code: "GUEST_ARRANGED", label: "Guest arranged" },
  { code: "NOT_NEEDED", label: "Not needed" },
] as const;

export const PICKUP_TYPES = [
  { code: "HQ_CAR", label: "HQ car" },
  { code: "DRIVER", label: "Driver" },
  { code: "TAXI", label: "Taxi / transfer" },
] as const;

export type HospitalityInput = {
  fromAbroad?: boolean;
  originCountry?: string;
  originCity?: string;
  stayNights?: number | null;
  stayFrom?: string;
  stayTo?: string;
  flightArrival?: string;
  flightDeparture?: string;
  hotelRequired?: boolean;
  hotelName?: string;
  hotelBookingStatus?: string;
  hotelRoomType?: string;
  pickupRequired?: boolean;
  pickupType?: string;
  pickupFrom?: string;
  pickupTime?: string;
  dropoffRequired?: boolean;
  mealBreakfast?: boolean;
  mealLunch?: boolean;
  mealDinner?: boolean;
  dietaryNeeds?: string;
  hospitalityNotes?: string;
  oneTimeVisit?: boolean;
  qrCheckInRequired?: boolean;
  guestNeedsJson?: string;
};

function dateOrNull(value?: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
}

export function hospitalityData(input: HospitalityInput) {
  const nights = input.stayNights == null || Number.isNaN(Number(input.stayNights)) ? null : Number(input.stayNights);
  const needs = parseGuestNeeds(input.guestNeedsJson);
  const flags = flagsFromNeeds(needs);
  return {
    fromAbroad: Boolean(input.fromAbroad || flags.fromAbroad),
    originCountry: input.originCountry?.trim() || null,
    originCity: input.originCity?.trim() || null,
    stayNights: nights,
    stayFrom: dateOrNull(input.stayFrom),
    stayTo: dateOrNull(input.stayTo),
    flightArrival: input.flightArrival?.trim() || null,
    flightDeparture: input.flightDeparture?.trim() || null,
    hotelRequired: Boolean(input.hotelRequired || flags.hotelRequired),
    hotelName: input.hotelName?.trim() || null,
    hotelBookingStatus: input.hotelBookingStatus || null,
    hotelRoomType: input.hotelRoomType?.trim() || null,
    pickupRequired: Boolean(input.pickupRequired || flags.pickupRequired),
    pickupType: input.pickupType || null,
    pickupFrom: input.pickupFrom?.trim() || null,
    pickupTime: input.pickupTime || null,
    dropoffRequired: Boolean(input.dropoffRequired || flags.dropoffRequired),
    mealBreakfast: Boolean(input.mealBreakfast || flags.mealBreakfast),
    mealLunch: Boolean(input.mealLunch || flags.mealLunch),
    mealDinner: Boolean(input.mealDinner || flags.mealDinner),
    dietaryNeeds: input.dietaryNeeds?.trim() || null,
    hospitalityNotes: input.hospitalityNotes?.trim() || null,
    oneTimeVisit: Boolean(input.oneTimeVisit),
    qrCheckInRequired: input.qrCheckInRequired !== false,
    guestNeedsJson: needs.length ? stringifyGuestNeeds(needs) : null,
  };
}

export function fromForm(formData: FormData): HospitalityInput {
  const nightsRaw = String(formData.get("stayNights") || "");
  return {
    fromAbroad: formData.get("fromAbroad") === "on",
    originCountry: String(formData.get("originCountry") || ""),
    originCity: String(formData.get("originCity") || ""),
    stayNights: nightsRaw ? Number(nightsRaw) : null,
    stayFrom: String(formData.get("stayFrom") || ""),
    stayTo: String(formData.get("stayTo") || ""),
    flightArrival: String(formData.get("flightArrival") || ""),
    flightDeparture: String(formData.get("flightDeparture") || ""),
    hotelRequired: formData.get("hotelRequired") === "on",
    hotelName: String(formData.get("hotelName") || ""),
    hotelBookingStatus: String(formData.get("hotelBookingStatus") || ""),
    hotelRoomType: String(formData.get("hotelRoomType") || ""),
    pickupRequired: formData.get("pickupRequired") === "on",
    pickupType: String(formData.get("pickupType") || ""),
    pickupFrom: String(formData.get("pickupFrom") || ""),
    pickupTime: String(formData.get("pickupTime") || ""),
    dropoffRequired: formData.get("dropoffRequired") === "on",
    mealBreakfast: formData.get("mealBreakfast") === "on",
    mealLunch: formData.get("mealLunch") === "on",
    mealDinner: formData.get("mealDinner") === "on",
    dietaryNeeds: String(formData.get("dietaryNeeds") || ""),
    hospitalityNotes: String(formData.get("hospitalityNotes") || ""),
    oneTimeVisit: formData.get("oneTimeVisit") === "on",
    qrCheckInRequired: formData.get("qrCheckInRequired") !== "off",
    guestNeedsJson: String(formData.get("guestNeedsJson") || ""),
  };
}

export function hasHospitality(visit: {
  fromAbroad: boolean;
  hotelRequired: boolean;
  pickupRequired: boolean;
  mealBreakfast: boolean;
  mealLunch: boolean;
  mealDinner: boolean;
  oneTimeVisit?: boolean;
  guestNeedsJson?: string | null;
}) {
  return (
    visit.fromAbroad ||
    visit.oneTimeVisit ||
    visit.hotelRequired ||
    visit.pickupRequired ||
    visit.mealBreakfast ||
    visit.mealLunch ||
    visit.mealDinner ||
    Boolean(parseGuestNeeds(visit.guestNeedsJson).length)
  );
}

export function mealSummary(visit: { mealBreakfast: boolean; mealLunch: boolean; mealDinner: boolean }) {
  const meals = [
    visit.mealBreakfast ? "Breakfast" : null,
    visit.mealLunch ? "Lunch" : null,
    visit.mealDinner ? "Dinner" : null,
  ].filter(Boolean);
  return meals.length ? meals.join(" · ") : "No meals requested";
}

export const TYPE_COLOR: Record<string, string> = {
  EMPLOYEE_VISIT: "#5b6b7c",
  CUSTOMER: "#0f7a74",
  SUPPLIER: "#2f6fed",
  WALK_IN: "#d97706",
  VIP: "#b45309",
  CANDIDATE: "#7c3aed",
  GROUP: "#0369a1",
  GENERAL: "#64748b",
  GUEST: "#64748b",
};
