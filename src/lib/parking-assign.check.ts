import assert from "node:assert/strict";
import { parkingAssignedCopy } from "./parking-assign";
import { canAssignStaffParking } from "./permissions";
import { normalizePlate, parkingMapLayout, parkingSlotMeta } from "./parking";

assert.equal(canAssignStaffParking("SYSTEM_ADMIN"), true);
assert.equal(canAssignStaffParking("HR_ADMIN"), false);
assert.equal(canAssignStaffParking("EMPLOYEE"), false);

assert.equal(parkingSlotMeta("B49").zone, "B");
assert.equal(parkingSlotMeta("B49").number, 49);
assert.equal(parkingSlotMeta("B49").section, 1);
assert.equal(parkingSlotMeta("B52").section, 2);
assert.equal(parkingSlotMeta("A25").section, 1);
assert.equal(parkingSlotMeta("A42").section, 2);

const layout = parkingMapLayout();
assert.equal(layout.length, 4);
assert.equal(layout[0].zone, "A");
assert.equal(layout[0].sections.length, 2);
assert.equal(layout[0].sections[0].slots.length, 9);
assert.equal(layout[0].sections[0].from, "A25");
assert.equal(layout[0].sections[0].to, "A33");
assert.equal(layout[0].sections[1].from, "A34");
assert.equal(layout[0].sections[1].to, "A42");
assert.equal(layout[1].sections[0].from, "B43");
assert.equal(layout[1].sections[0].to, "B51");
assert.equal(layout[1].sections[1].from, "B52");
assert.equal(layout[1].sections[1].to, "B60");
assert.equal(layout[1].sections[0].slots[6], "B49");
assert.equal(layout[2].sections[0].from, "C61");
assert.equal(layout[2].sections[1].to, "C78");
assert.equal(layout[3].sections[0].from, "D79");
assert.equal(layout[3].sections[1].to, "D96");

assert.equal(normalizePlate("  abc 123 "), "ABC 123");
const copy = parkingAssignedCopy({
  name: "Jad Sakour",
  slot: "B49",
  vehicles: [
    { plate: "A 12345", vehicleType: "SUV" },
    { plate: "B 67890", vehicleType: null },
  ],
});
assert.match(copy.message, /Hello Jad Sakour/);
assert.match(copy.message, /Parking number 49 in Zone B/);
assert.match(copy.message, /Human Resources/);
assert.match(copy.message, /Vehicle plates: A 12345 \(SUV\), B 67890/);

console.log("parking-assign.check: ok");
