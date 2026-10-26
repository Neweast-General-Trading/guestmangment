import assert from "node:assert/strict";
import { INTRANET_CORS_HEADERS, intranetKeyOk, readIntranetApiKey } from "./intranet-api";
import { intranetParkingView, readIntranetParkingQuery } from "./intranet-parking";

assert.deepEqual(readIntranetParkingQuery({ email: " sakour@neweast.co ", empId: " 101 " }), {
  email: "sakour@neweast.co",
  empId: "101",
});
assert.deepEqual(readIntranetParkingQuery({ mail: "sakour@neweast.com", payrollNo: "88" }), {
  email: "sakour@neweast.com",
  empId: "88",
});
assert.deepEqual(readIntranetParkingQuery({}), { email: null, empId: null });

const view = intranetParkingView({ name: "Jad Sakour", slot: "B49", plate: "A 12345", vehicleType: "SUV" });
assert.equal(view.assigned, true);
assert.equal(view.slot, "B49");
assert.equal(view.zone, "B");
assert.equal(view.number, 49);
assert.equal(view.section, 1);
assert.deepEqual(view.vehicles, [{ plate: "A 12345", vehicleType: "SUV" }]);
assert.equal(view.label, "Parking number 49 in Zone B");
assert.equal(view.message, "Your parking bay is number 49 in Zone B.");
const multi = intranetParkingView({
  name: "Jad Sakour",
  slot: "C69",
  vehicles: '[{"plate":"AD-22-75348","vehicleType":"SUV"},{"plate":"B 100","vehicleType":null}]',
});
assert.deepEqual(multi.vehicles, [
  { plate: "AD-22-75348", vehicleType: "SUV" },
  { plate: "B 100", vehicleType: null },
]);

assert.equal(
  readIntranetApiKey(new Request("https://guest.neweast.cloud/api/intranet/parking", { headers: { "x-intranet-key": "abc" } })),
  "abc",
);
assert.equal(
  readIntranetApiKey(
    new Request("https://guest.neweast.cloud/api/intranet/parking", { headers: { authorization: "Bearer xyz" } }),
  ),
  "xyz",
);
assert.equal(intranetKeyOk(""), false);
assert.equal(INTRANET_CORS_HEADERS["Access-Control-Allow-Origin"], "*");

console.log("intranet-parking.check: ok");
