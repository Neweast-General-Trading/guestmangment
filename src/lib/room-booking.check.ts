import assert from "node:assert/strict";
import { staffRoomHoldMailCopy } from "./mail";
import { attachRoomHoldNotes, mergeRoomDayEvents, parseRoomInvitees, parseStoredInvitees, staffRoomEventBody } from "./room-booking";

assert.equal(
  staffRoomEventBody({ name: "Mais Ali", email: "mais@neweast.co", description: "Board meeting\nHDMI" }),
  "Booked from Guest Management by Mais Ali <mais@neweast.co>.\n\nDescription\nBoard meeting\nHDMI",
);
assert.equal(
  staffRoomEventBody({ name: "Mais Ali", email: "mais@neweast.co" }),
  "Booked from Guest Management by Mais Ali <mais@neweast.co>.",
);

const events = attachRoomHoldNotes(
  [{ id: "evt-1", subject: "Guest visit · FF1", start: "10:00", end: "11:00", room: "FF1", roomReply: "pending" }],
  [{ eventId: "evt-1", description: "Dealers visit" }],
);
assert.equal(events[0].description, "Dealers visit");

const invitees = parseRoomInvitees(
  ["Mais Ali <mais@neweast.co>", "sakour@neweast.co, reception@neweast.co", "MAIS@neweast.co"],
  "sakour@neweast.co",
);
assert.deepEqual(
  invitees.map((item) => item.email),
  ["mais@neweast.co", "reception@neweast.co"],
);
assert.equal(parseRoomInvitees(["not-an-email", "a@b.co; c@d.co"]).length, 2);
assert.equal(parseRoomInvitees(Array.from({ length: 30 }, (_, index) => `p${index}@neweast.co`)).length, 20);

const stored = parseStoredInvitees(JSON.stringify([{ email: "Mais@neweast.co", name: "Mais Ali" }, "olga@neweast.co"]));
assert.equal(stored[0].email, "mais@neweast.co");
assert.equal(stored[0].name, "Mais Ali");
assert.equal(stored[1].email, "olga@neweast.co");

const merged = mergeRoomDayEvents(
  [{ id: "evt-guest", subject: "Visit", start: "09:00", end: "10:00", room: "FF1", roomReply: "accepted" }],
  [{ id: "evt-hold", subject: "Staff hold", start: "11:00", end: "12:00", room: "VIP", roomReply: "pending", description: "Dealers" }],
);
assert.equal(merged.length, 2);
assert.equal(merged.find((item) => item.id === "evt-hold")?.description, "Dealers");

const accepted = staffRoomHoldMailCopy({
  name: "Mais Ali",
  room: "VIP Conference",
  date: "07 Oct 2026",
  start: "10:00",
  end: "11:00",
  subject: "Guest visit · VIP Conference",
  description: "Board meeting with dealers",
  accepted: true,
});
assert.match(accepted.subject, /^Confirmed · VIP Conference/);
assert.equal(accepted.hello, "Hello Mais,");
assert.match(accepted.intro, /VIP Conference/);
assert.match(accepted.intro, /confirmed/);
assert.equal(accepted.note, "Board meeting with dealers");

const declined = staffRoomHoldMailCopy({
  name: "Reception Desk",
  room: "FF1",
  date: "07 Oct 2026",
  start: "14:00",
  end: "15:00",
  subject: "Guest visit · FF1",
  accepted: false,
});
assert.match(declined.subject, /^Not confirmed · FF1/);
assert.equal(declined.hello, "Hello Reception,");
assert.match(declined.intro, /not accepted/);

console.log("room-booking.check: ok");
