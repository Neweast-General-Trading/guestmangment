import assert from "node:assert/strict";
import { defaultArrivalTime, isPastVisitSchedule } from "./visit-schedule";
import { authorizationBanner, resolveQrGateAction } from "./visits";

function check() {
  assert.equal(authorizationBanner("EXPECTED").label, "APPROVED – READY FOR CHECK-IN");
  assert.equal(authorizationBanner("PENDING_APPROVAL").tone, "warn");
  assert.equal(authorizationBanner("REJECTED").tone, "danger");
  assert.equal(authorizationBanner("CANCELLED").label, "CANCELLED");
  assert.equal(authorizationBanner("CURRENTLY_INSIDE").label, "CURRENTLY INSIDE");

  const ready = { checkInAt: null, checkOutAt: null, status: "EXPECTED" };
  const inside = { checkInAt: new Date(), checkOutAt: null, status: "CURRENTLY_INSIDE" };
  const done = { checkInAt: new Date(), checkOutAt: new Date(), status: "COMPLETED" };
  assert.deepEqual(resolveQrGateAction("in", ready), { action: "in" });
  assert.deepEqual(resolveQrGateAction("out", inside), { action: "out" });
  assert.deepEqual(resolveQrGateAction("out", ready), { error: "Visitor is not inside. Use Check-in first." });
  assert.deepEqual(resolveQrGateAction("in", inside), { error: "Visitor is already inside. Switch to Check-out." });
  assert.deepEqual(resolveQrGateAction("out", done), { error: "Visitor already checked out." });
  assert.equal(isPastVisitSchedule("2020-01-01", "09:00"), true);
  assert.equal(isPastVisitSchedule("2099-01-01", "09:00"), false);
  assert.equal(defaultArrivalTime("2099-01-01", new Date("2026-09-22T12:00:00+04:00")), "09:30");
  assert.equal(defaultArrivalTime("2026-09-22", new Date("2026-09-22T12:00:00+04:00")), "12:00");

  console.log("visits.check: ok");
}

check();
