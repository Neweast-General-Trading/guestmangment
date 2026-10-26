import assert from "node:assert/strict";
import { canSeeTracking } from "./access";
import { navFor } from "./permissions";
import { inTrackingRange, mergeTrackingRooms, trackingHref, trackingSourceLabel, trackingTab } from "./tracking";

assert.equal(canSeeTracking("sakour@neweast.co"), true);
assert.equal(canSeeTracking("salma.moufallah@neweast.com"), true);
assert.equal(canSeeTracking("salma.moufallah@neweast.co"), true);
assert.equal(canSeeTracking("guru@neweast.co"), false);
assert.equal(canSeeTracking("olga@neweast.co"), false);

assert.ok(navFor("SYSTEM_ADMIN", "sakour@neweast.co").some((item) => item.href === "/tracking"));
assert.ok(navFor("SYSTEM_ADMIN", "salma.moufallah@neweast.com").some((item) => item.href === "/tracking"));
assert.equal(navFor("SYSTEM_ADMIN", "guru@neweast.co").some((item) => item.href === "/tracking"), false);
assert.equal(navFor("EMPLOYEE", "rizwan@neweast.co").some((item) => item.href === "/tracking"), false);

assert.equal(trackingTab("rooms"), "rooms");
assert.equal(trackingTab("nope"), "visits");
assert.equal(trackingSourceLabel("STAFF"), "Staff request");
assert.equal(trackingHref({ tab: "rooms", q: "tokyo" }), "/tracking?tab=rooms&q=tokyo");
assert.equal(trackingHref({ tab: "visits", page: 2, pageSize: 50 }), "/tracking?page=2&pageSize=50");
assert.equal(
  trackingHref({ tab: "rooms", room: "Tokyo", booker: "sakour@neweast.co" }),
  "/tracking?tab=rooms&room=Tokyo&booker=sakour%40neweast.co",
);
assert.equal(inTrackingRange(new Date("2026-10-22T10:00:00"), "2026-10-01", "2026-10-31"), true);
assert.equal(inTrackingRange(new Date("2026-09-01T10:00:00"), "2026-10-01", "2026-10-31"), false);

const start = new Date("2026-10-22T10:00:00");
const merged = mergeTrackingRooms(
  [
    {
      id: "hold-1",
      roomName: "Tokyo",
      roomEmail: "tokyo@neweast.co",
      subject: "Guest visit",
      startAt: start,
      endAt: new Date("2026-10-22T11:00:00"),
      bookedByName: "Jad Sakour",
      bookedByEmail: "sakour@neweast.co",
      invitees: "[]",
      cancelledAt: null,
      roomReply: "accepted",
    },
  ],
  [
    {
      id: "outlook-1",
      roomName: "Tokyo",
      roomEmail: "tokyo@neweast.co",
      subject: "Guest visit",
      startAt: start,
      endAt: new Date("2026-10-22T11:00:00"),
    },
    {
      id: "outlook-2",
      roomName: "Paris",
      roomEmail: "paris@neweast.co",
      subject: "Board",
      startAt: start,
      endAt: new Date("2026-10-22T11:00:00"),
    },
  ],
);
assert.equal(merged.length, 2);
assert.equal(merged.some((row) => row.origin === "outlook" && row.roomName === "Paris"), true);
assert.equal(merged.filter((row) => row.roomName === "Tokyo").length, 1);
assert.equal(merged[0].createdAt instanceof Date, true);

console.log("tracking.check: ok");
