import assert from "node:assert/strict";
import {
  isParkingSlot,
  normalizePlate,
  parkingMapLayout,
  parkingVehiclesFromPairs,
  parkingVehiclesFromStored,
  PARKING_SLOTS,
  PARKING_SLOTS_PER_ZONE,
  PARKING_ZONES,
  parkingZoneStart,
  plateListLabel,
  remapLegacyParkingSlot,
  requireParkingVehicles,
} from "./parking";

assert.equal(PARKING_ZONES.length, 4);
assert.equal(PARKING_SLOTS.length, 72);
assert.equal(PARKING_SLOTS.filter((slot) => slot.startsWith("A")).length, PARKING_SLOTS_PER_ZONE);
assert.equal(PARKING_SLOTS[0], "A25");
assert.equal(PARKING_SLOTS[17], "A42");
assert.equal(PARKING_SLOTS[18], "B43");
assert.equal(PARKING_SLOTS[35], "B60");
assert.equal(PARKING_SLOTS[36], "C61");
assert.equal(PARKING_SLOTS[53], "C78");
assert.equal(PARKING_SLOTS[54], "D79");
assert.equal(PARKING_SLOTS[71], "D96");
assert.equal(parkingZoneStart("A"), 25);
assert.equal(parkingZoneStart("B"), 43);
assert.equal(parkingZoneStart("C"), 61);
assert.equal(parkingZoneStart("D"), 79);
assert.equal(isParkingSlot("A25"), true);
assert.equal(isParkingSlot("B43"), true);
assert.equal(isParkingSlot("B25"), false);
assert.equal(isParkingSlot("A24"), false);
assert.equal(isParkingSlot("E25"), false);
assert.equal(remapLegacyParkingSlot("A25"), "A25");
assert.equal(remapLegacyParkingSlot("B25"), "B43");
assert.equal(remapLegacyParkingSlot("B31"), "B49");
assert.equal(remapLegacyParkingSlot("C33"), "C69");
assert.equal(remapLegacyParkingSlot("D42"), "D96");
assert.equal(normalizePlate(" aa-123 "), "AA-123");
assert.deepEqual(requireParkingVehicles([" a-1 ", "", "a-1", "b-2"], ["SUV", "", "Van", ""]), [
  { plate: "A-1", vehicleType: "SUV" },
  { plate: "B-2", vehicleType: null },
]);
assert.equal(plateListLabel(parkingVehiclesFromPairs(["A 1", "B 2"])), "A 1 · B 2");
assert.deepEqual(
  parkingVehiclesFromStored({ plate: "OLD 1", vehicleType: "Sedan", vehicles: '[{"plate":"NEW 2","vehicleType":"SUV"}]' }),
  [{ plate: "NEW 2", vehicleType: "SUV" }],
);
assert.deepEqual(parkingVehiclesFromStored({ plate: "OLD 1", vehicleType: "Sedan", vehicles: "[]" }), [
  { plate: "OLD 1", vehicleType: "Sedan" },
]);
assert.equal(parkingMapLayout().reduce((sum, zone) => sum + zone.sections.reduce((n, section) => n + section.slots.length, 0), 0), 72);
console.log("parking.check: ok");
