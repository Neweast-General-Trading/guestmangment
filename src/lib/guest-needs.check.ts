import assert from "node:assert/strict";
import {
  GUEST_NEEDS,
  flagsFromNeeds,
  filterNeeds,
  pageItems,
  parseGuestNeeds,
  stringifyGuestNeeds,
} from "./guest-needs";

assert.ok(GUEST_NEEDS.length > 8, "catalog must be long enough to paginate");
assert.equal(pageItems(GUEST_NEEDS, 1).slice.length, 8);
assert.equal(pageItems(GUEST_NEEDS, 1).page, 1);
assert.equal(pageItems(GUEST_NEEDS, 99).page, pageItems(GUEST_NEEDS, 99).pages);
assert.equal(pageItems(GUEST_NEEDS, 2).from, 9);

const parsed = parseGuestNeeds(
  JSON.stringify([
    { code: "HOTEL", notes: "Four Seasons" },
    { code: "HOTEL", notes: "dup" },
    { code: "??", notes: "x" },
    "LUNCH",
  ]),
);
assert.deepEqual(
  parsed.map((item) => item.code),
  ["HOTEL", "LUNCH"],
);
assert.equal(parsed[0].notes, "Four Seasons");
assert.equal(parseGuestNeeds("not-json").length, 0);

const flags = flagsFromNeeds([{ code: "AIRPORT_PICKUP", notes: "" }, { code: "PARKING", notes: "" }]);
assert.equal(flags.pickupRequired, true);
assert.equal(flags.parkingRequired, true);
assert.equal(flags.hotelRequired, false);
assert.equal(flagsFromNeeds([{ code: "FROM_ABROAD", notes: "" }]).fromAbroad, true);
assert.equal(flagsFromNeeds([{ code: "AIRPORT_WAIT", notes: "" }]).pickupRequired, true);

const stay = filterNeeds(GUEST_NEEDS, "", "stay");
assert.ok(stay.every((item) => item.category === "stay"));
assert.ok(filterNeeds(GUEST_NEEDS, "wifi", "all").some((item) => item.code === "WIFI"));

const roundTrip = parseGuestNeeds(stringifyGuestNeeds(parsed));
assert.deepEqual(roundTrip, parsed);

console.log("guest-needs.check ok");
