import assert from "node:assert/strict";
import { preparationLabel, preparationNote } from "./preparation";

const waiting = {
  status: "INTAKE",
  meetingRoom: "Berlin",
  gatePassRequired: true,
  gatePassStatus: "PREPARING",
  giftRequired: true,
  giftStatus: "PENDING",
  driverRequired: false,
  visitors: [{ gatePassRequired: true, gatePassStatus: "PREPARING", giftRequired: true, giftStatus: "PENDING" }],
};

assert.equal(preparationNote(waiting), "Waiting on Gate pass, Gift");
assert.equal(preparationNote({ ...waiting, status: "EXPECTED" }), "");
assert.equal(preparationLabel({ ...waiting, status: "EXPECTED" }), "Preparing");
assert.equal(preparationLabel({ ...waiting, status: "EXPECTED", roomConfirmRepliedAt: "2026-11-02T05:05:07.284Z" }), "Meeting room confirmed");
assert.equal(
  preparationLabel({
    ...waiting,
    status: "EXPECTED",
    calendarInvitedAt: "2026-11-02T05:39:35.615Z",
    gatePassStatus: "DONE",
    giftStatus: "DONE",
    visitors: [{ gatePassRequired: true, gatePassStatus: "DONE", giftRequired: true, giftStatus: "DONE" }],
  }),
  "Ready",
);
assert.equal(
  preparationNote({ ...waiting, gatePassStatus: "DONE", giftStatus: "DONE", visitors: [{ gatePassRequired: true, gatePassStatus: "DONE", giftRequired: true, giftStatus: "DONE" }] }),
  "",
);

console.log("preparation.check: ok");
