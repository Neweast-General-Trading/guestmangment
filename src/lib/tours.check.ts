import assert from "node:assert/strict";
import { isSalmaEmail, isSamirEmail, parseTourType } from "./constants";
import { visitDetailLines, tourBlocksConfirm, visitBlocksConfirm, tourLabel, buildingTourAutoApproved } from "./tours";

assert.equal(parseTourType("building tour"), "BUILDING");
assert.equal(parseTourType("GF"), "GF");
assert.equal(parseTourType(""), "NONE");
assert.equal(tourLabel("BUILDING"), "Building Tour");
assert.equal(tourBlocksConfirm({ tourType: "BUILDING", tourStatus: "PENDING" }), true);
assert.equal(tourBlocksConfirm({ tourType: "BUILDING", tourStatus: "APPROVED" }), false);
assert.equal(tourBlocksConfirm({ tourType: "GF", tourStatus: null }), false);
assert.equal(visitBlocksConfirm({ tourType: "GF", tourStatus: null, guestKind: "CUSTOMER", supplierStatus: null }), false);
assert.equal(visitBlocksConfirm({ tourType: "NONE", guestKind: "SUPPLIER", supplierStatus: "PENDING" }), false);
assert.equal(visitBlocksConfirm({ tourType: "NONE", guestKind: "SUPPLIER", supplierStatus: "APPROVED" }), false);
assert.equal(visitBlocksConfirm({ tourType: "NONE", guestKind: "SUPPLIER", supplierStatus: null }), false);
assert.equal(isSalmaEmail("salma.moufallah@neweast.com"), true);
assert.equal(isSalmaEmail("salma.moufallah@neweast.co"), true);
assert.equal(isSamirEmail("samir.ibrahim@neweast.co"), true);
assert.equal(isSamirEmail("sakour@neweast.co"), false);
assert.equal(buildingTourAutoApproved("salma.moufallah@neweast.com"), true);
assert.equal(buildingTourAutoApproved("sakour@neweast.co"), false);

const lines = visitDetailLines({
  visitCode: "GV-2026-000099",
  purpose: "Showroom walkthrough",
  guestKind: "CUSTOMER",
  type: "CUSTOMER",
  tourType: "BUILDING",
  expectedArrival: new Date("2026-11-02T10:00:00+04:00"),
  expectedDeparture: new Date("2026-11-02T11:00:00+04:00"),
  meetingRoom: "Tokyo",
  visitorCount: 1,
  driverRequired: true,
  giftRequired: false,
  gatePassRequired: false,
  createdBy: { name: "Jad Sakour" },
  host: { name: "Jad Sakour" },
  department: { name: "Business Systems" },
  visitors: [
    {
      visitor: {
        fullName: "Ahmed Ali",
        mobile: "0500000000",
        email: "ahmed@example.com",
        company: "NEWEAST",
        jobTitle: "Buyer",
      },
    },
  ],
});
assert.ok(lines.some((line) => line.includes("GV-2026-000099")));
assert.ok(lines.some((line) => line.includes("Customer")));
assert.ok(lines.some((line) => line.includes("Building Tour")));
assert.ok(lines.some((line) => line.includes("Tokyo")));
assert.ok(lines.some((line) => line.includes("Ahmed Ali")));
assert.ok(lines.some((line) => /Showroom walkthrough/.test(line)));

console.log("tours.check: ok");
