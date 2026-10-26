export const PARKING_ZONES = ["A", "B", "C", "D"] as const;
export const PARKING_SLOT_START = 25;
export const PARKING_SLOTS_PER_ZONE = 18;
export const PARKING_SECTIONS_PER_ZONE = 2;
export const PARKING_SLOTS_PER_SECTION = 9;

export type ParkingZone = (typeof PARKING_ZONES)[number];

export const PARKING_VEHICLE_TYPES = ["Sedan", "SUV", "Van", "Pickup", "Motorcycle", "Other"] as const;

export function normalizePlate(value: string) {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

export type ParkingVehicle = { plate: string; vehicleType: string | null };

export function parkingVehiclesFromPairs(plates: string[], types: Array<string | null | undefined> = []) {
  const seen = new Set<string>();
  const items: ParkingVehicle[] = [];
  for (let index = 0; index < plates.length; index += 1) {
    const plate = normalizePlate(plates[index] || "");
    if (!plate || seen.has(plate)) continue;
    const vehicleType = String(types[index] || "").trim() || null;
    if (vehicleType && !(PARKING_VEHICLE_TYPES as readonly string[]).includes(vehicleType)) {
      throw new Error("Choose a valid vehicle type.");
    }
    seen.add(plate);
    items.push({ plate, vehicleType });
  }
  return items;
}

export function requireParkingVehicles(plates: string[], types: Array<string | null | undefined> = []) {
  const items = parkingVehiclesFromPairs(plates, types);
  if (!items.length) throw new Error("Vehicle plate is required.");
  return items;
}

export function parseParkingVehiclesJson(raw?: string | null): ParkingVehicle[] {
  if (!raw?.trim()) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return parkingVehiclesFromPairs(
      data.map((item) => (item && typeof item === "object" && "plate" in item ? String((item as ParkingVehicle).plate || "") : "")),
      data.map((item) => (item && typeof item === "object" && "vehicleType" in item ? (item as ParkingVehicle).vehicleType : null)),
    );
  } catch {
    return [];
  }
}

export function parkingVehiclesFromStored(input: { plate?: string | null; vehicleType?: string | null; vehicles?: string | null }) {
  const stored = parseParkingVehiclesJson(input.vehicles);
  if (stored.length) return stored;
  return parkingVehiclesFromPairs([input.plate || ""], [input.vehicleType]);
}

export function plateListLabel(vehicles: ParkingVehicle[]) {
  return vehicles.map((item) => item.plate).filter(Boolean).join(" · ");
}

export function vehiclesJson(vehicles: ParkingVehicle[]) {
  return JSON.stringify(vehicles);
}

export function parkingZoneStart(zone: string) {
  const zoneIndex = PARKING_ZONES.indexOf(zone.toUpperCase() as ParkingZone);
  if (zoneIndex < 0) return PARKING_SLOT_START;
  return PARKING_SLOT_START + zoneIndex * PARKING_SLOTS_PER_ZONE;
}

export const PARKING_SLOTS = PARKING_ZONES.flatMap((zone) =>
  Array.from({ length: PARKING_SLOTS_PER_ZONE }, (_, index) => `${zone}${parkingZoneStart(zone) + index}`),
);

export function isParkingSlot(value: string) {
  return PARKING_SLOTS.includes(value);
}

export function remapLegacyParkingSlot(code: string) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed || isParkingSlot(trimmed)) return trimmed;
  const zone = trimmed.slice(0, 1);
  const number = Number(trimmed.slice(1));
  if (!(PARKING_ZONES as readonly string[]).includes(zone) || !Number.isInteger(number)) return trimmed;
  const offset = number - PARKING_SLOT_START;
  if (offset < 0 || offset >= PARKING_SLOTS_PER_ZONE) return trimmed;
  return `${zone}${parkingZoneStart(zone) + offset}`;
}

export function parkingSelectOptions(current?: string | null) {
  const selected = current ? remapLegacyParkingSlot(current) : "";
  const options = PARKING_SLOTS.map((code) => ({
    value: code,
    label: code,
    hint: `Zone ${code[0]}`,
  }));
  if (selected && !isParkingSlot(selected)) {
    options.unshift({ value: selected, label: selected, hint: "Current" });
  }
  return options;
}

export function parkingSlotMeta(code: string) {
  const zone = code.slice(0, 1).toUpperCase();
  const number = Number(code.slice(1));
  const offset = number - parkingZoneStart(zone);
  const section = offset < PARKING_SLOTS_PER_SECTION ? 1 : 2;
  return {
    code,
    zone,
    number,
    section,
    indexInSection: (offset % PARKING_SLOTS_PER_SECTION) + 1,
  };
}

export function parkingMapLayout() {
  return PARKING_ZONES.map((zone) => {
    const slots = PARKING_SLOTS.filter((slot) => slot.startsWith(zone));
    return {
      zone,
      sections: [1, 2].map((section) => {
        const rows = slots.slice((section - 1) * PARKING_SLOTS_PER_SECTION, section * PARKING_SLOTS_PER_SECTION);
        return {
          section,
          label: `Section ${section}`,
          from: rows[0],
          to: rows[rows.length - 1],
          slots: rows,
        };
      }),
    };
  });
}
