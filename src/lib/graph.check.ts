import assert from "node:assert/strict";
import {
  applyScheduleItems,
  attachGuestEvents,
  findRoomByName,
  isDummyMail,
  isReleasedBooking,
  isRoomReplyMail,
  roomKey,
  sameRoom,
  roomDayScheduleEnd,
  roomDaySlots,
  bookerCalendarBody,
  roomEventBody,
  withRequiredAttendee,
  roomIsFree,
  roomMailStatus,
  roomMailTitle,
  roomReplyFrom,
  visitCodeFromSubject,
  splitInboxHeads,
  toDubaiClock,
} from "./graph";

assert.equal(roomIsFree("00"), true);
assert.equal(roomIsFree("0"), true);
assert.equal(roomIsFree("02"), false);
assert.equal(roomIsFree("1"), false);
assert.equal(roomIsFree(""), true);

const rooms = [
  { name: "VIP Conference", email: "vip.conference@neweast.co", capacity: 8, floor: "1", available: true },
];
assert.equal(findRoomByName(rooms, "vip conference")?.email, "vip.conference@neweast.co");
assert.equal(findRoomByName(rooms, "Boardroom A"), null);

const payload = roomEventBody({
  subject: "GV-1 · Guest",
  body: "Purpose",
  start: new Date("2026-09-24T10:30:00+04:00"),
  end: new Date("2026-09-24T11:30:00+04:00"),
  room: rooms[0],
});
assert.equal(payload.attendees[0].type, "resource");
assert.equal(payload.attendees[0].emailAddress.address, "vip.conference@neweast.co");
const withPeople = roomEventBody({
  subject: "Guest visit · VIP Conference",
  body: "Agenda",
  start: new Date("2026-09-24T10:30:00+04:00"),
  end: new Date("2026-09-24T11:30:00+04:00"),
  room: rooms[0],
  attendees: [{ email: "mais@neweast.co", name: "Mais Ali" }],
});
assert.equal(withPeople.attendees.length, 2);
assert.equal(withPeople.attendees.at(-1)?.type, "required");
assert.equal(withPeople.attendees.at(-1)?.emailAddress.address, "mais@neweast.co");
assert.equal(payload.start.timeZone, "Asia/Dubai");
assert.equal(payload.responseRequested, true);
const attendees = withRequiredAttendee(payload.attendees, "sakour@neweast.co", "Jad Sakour");
assert.equal(attendees.length, 2);
assert.equal(attendees.at(-1)?.type, "required");
assert.equal(attendees.at(-1)?.emailAddress?.address, "sakour@neweast.co");
assert.equal(withRequiredAttendee(attendees, "sakour@neweast.co", "Jad").length, 2);
const onCalendar = bookerCalendarBody({
  subject: "Guest visit · VIP Conference",
  description: "Board meeting",
  start: new Date("2026-09-24T10:30:00+04:00"),
  end: new Date("2026-09-24T11:30:00+04:00"),
  roomName: "VIP Conference",
  roomEmail: "vip.conference@neweast.co",
});
assert.equal(onCalendar.location.displayName, "VIP Conference");
assert.match(onCalendar.body.content, /Board meeting/);
assert.equal(onCalendar.showAs, "busy");

const slots = roomDaySlots();
assert.equal(slots[0], "07:00");
assert.equal(slots.at(-1), "21:00");
assert.equal(slots.includes("12:00"), true);
assert.equal(slots.includes("21:00"), true);
assert.equal(roomDayScheduleEnd(), "21:30:00");
assert.equal(slots.length, 29);
const marked = applyScheduleItems(
  slots.map((time) => ({ time, free: true })),
  [{ subject: "Guest visit · VIP Conference", start: { dateTime: "2026-09-24T10:00:00" }, end: { dateTime: "2026-09-24T11:00:00" } }],
);
assert.equal(marked.find((slot) => slot.time === "10:00")?.free, false);
assert.equal(marked.find((slot) => slot.time === "10:30")?.booking?.subject, "Guest visit · VIP Conference");
assert.equal(marked.find((slot) => slot.time === "09:30")?.free, true);
assert.equal(toDubaiClock("2026-09-24T06:00:00.0000000", "UTC"), "10:00");
const utcMarked = applyScheduleItems(
  roomDaySlots().map((time) => ({ time, free: true })),
  [{ subject: "Hold", start: { dateTime: "2026-09-24T06:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-09-24T07:00:00.0000000", timeZone: "UTC" } }],
);
assert.equal(utcMarked.find((slot) => slot.time === "10:00")?.booking?.subject, "Hold");
assert.equal(roomReplyFrom("accepted"), "accepted");
assert.equal(roomReplyFrom("declined"), "declined");
assert.equal(roomReplyFrom("none"), "pending");
assert.equal(isRoomReplyMail("MB_FF_MeetingRoom_1@neweast.co", "Accepted: Guest visit"), true);
assert.equal(isRoomReplyMail("jad@neweast.co", "meeting"), false);
const confirmed = applyScheduleItems(
  roomDaySlots().map((time) => ({ time, free: true })),
  [
    {
      subject: "Hold",
      roomReply: "accepted",
      start: { dateTime: "2026-09-24T10:00:00", timeZone: "Asia/Dubai" },
      end: { dateTime: "2026-09-24T11:00:00", timeZone: "Asia/Dubai" },
    },
  ],
);
assert.equal(confirmed.find((slot) => slot.time === "10:00")?.booking?.roomReply, "accepted");
assert.equal(roomMailStatus("Accepted: Guest visit · FF1"), "accepted");
assert.equal(roomMailStatus("Declined: Guest visit · FF1"), "declined");
assert.equal(roomMailTitle("Accepted: Guest visit · FF1"), "Guest visit · FF1");
const split = splitInboxHeads([
  {
    id: "1",
    internetMessageId: "a",
    subject: "meeting",
    from: "jad@neweast.co",
    fromName: "Jad",
    hasAttachments: true,
    receivedAt: "2026-09-23T08:00:00Z",
  },
  {
    id: "2",
    internetMessageId: "b",
    subject: "Accepted: Guest visit · FF1",
    from: "MB_FF_MeetingRoom_1@neweast.co",
    fromName: "MB_FF_Meeting Room_1",
    hasAttachments: false,
    receivedAt: "2026-09-23T09:00:00Z",
  },
]);
assert.equal(split.requests.length, 1);
assert.equal(split.rooms.length, 1);
assert.equal(split.rooms[0]?.fromName, "MB_FF_Meeting Room_1");
assert.equal(isDummyMail("Accepted: Confirm-check hold"), true);
assert.equal(isDummyMail("Accepted: Guest visit room hold"), true);
assert.equal(isDummyMail("Accepted: Guest visit · FF1"), false);
assert.equal(isReleasedBooking({ subject: "Canceled: Guest visit · FF1" }), true);
assert.equal(isReleasedBooking({ roomReply: "declined" }), true);
assert.equal(isReleasedBooking({ roomReply: "accepted" }), false);
const released = applyScheduleItems(
  roomDaySlots().map((time) => ({ time, free: false })),
  [
    {
      subject: "Canceled: Hold",
      start: { dateTime: "2026-09-24T10:00:00", timeZone: "Asia/Dubai" },
      end: { dateTime: "2026-09-24T11:00:00", timeZone: "Asia/Dubai" },
    },
  ],
);
assert.equal(released.find((slot) => slot.time === "10:00")?.free, true);
assert.equal(released.find((slot) => slot.time === "10:00")?.booking?.cancelled, true);
const declined = applyScheduleItems(
  roomDaySlots().map((time) => ({ time, free: true })),
  [
    {
      subject: "Hold",
      roomReply: "declined",
      start: { dateTime: "2026-09-24T10:00:00", timeZone: "Asia/Dubai" },
      end: { dateTime: "2026-09-24T11:00:00", timeZone: "Asia/Dubai" },
    },
  ],
);
assert.equal(declined.find((slot) => slot.time === "10:00")?.free, true);
const ours = applyScheduleItems(
  roomDaySlots().map((time) => ({ time, free: true })),
  [
    {
      subject: "Guest visit · FF1",
      ours: true,
      start: { dateTime: "2026-09-24T11:00:00", timeZone: "Asia/Dubai" },
      end: { dateTime: "2026-09-24T12:00:00", timeZone: "Asia/Dubai" },
    },
  ],
);
assert.equal(ours.find((slot) => slot.time === "11:00")?.booking?.ours, true);
assert.equal(ours.find((slot) => slot.time === "11:00")?.free, false);
assert.equal(roomKey("MB_FF_Meeting Room_2"), "mbffmeetingroom2");
assert.equal(sameRoom({ name: "MB_FF_Meeting Room_2" }, { room: "MB_FF_MeetingRoom_2" }), true);
assert.equal(visitCodeFromSubject("Accepted: GV-2026-000007 · Ashwin"), "GV-2026-000007");
const overlay = attachGuestEvents(
  [
    {
      name: "MB_FF_Meeting Room_2",
      email: "mb_ff_meetingroom_2@neweast.co",
      capacity: 10,
      floor: "1",
      available: false,
      slots: roomDaySlots().map((time) => ({ time, free: time !== "15:30" && time !== "16:00" })),
    },
  ],
  [
    {
      id: "1",
      subject: "GV-2026-000007 · Ashwin",
      start: "15:30",
      end: "16:30",
      room: "MB_FF_MeetingRoom_2",
      roomReply: "accepted",
    },
  ],
);
assert.equal(overlay[0]?.slots.find((slot) => slot.time === "15:30")?.booking?.ours, true);
assert.equal(overlay[0]?.slots.find((slot) => slot.time === "15:30")?.booking?.subject, "GV-2026-000007 · Ashwin");
console.log("graph.check ok");
