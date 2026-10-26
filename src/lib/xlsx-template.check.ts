import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  excelSerialToDate,
  excelSerialToTime,
  parseXlsxGuestRequest,
  requestFromCells,
} from "./xlsx-template";

assert.equal(excelSerialToDate(46287), "2026-09-22");
assert.equal(excelSerialToTime(0.70833333333333337), "17:00");

const cells = new Map<string, string>([
  ["A5", "Visit date"],
  ["B5", "2026-09-24"],
  ["A6", "Arrival time"],
  ["B6", "10:30"],
  ["A7", "Department"],
  ["B7", "Sales"],
  ["A8", "Guest type"],
  ["B8", "Customer"],
  ["A9", "Driver required"],
  ["B9", "Yes"],
  ["A10", "Purpose"],
  ["B10", "Quarterly review"],
  ["A14", "Full name"],
  ["B14", "Mobile"],
  ["C14", "Email"],
  ["A15", "Ashwin"],
  ["B15", "506478022"],
  ["C15", "ashwin@neweast.co"],
]);
const parsed = requestFromCells(cells);
assert.ok(parsed);
assert.equal(parsed.visitDate, "2026-09-24");
assert.equal(parsed.arrivalTime, "10:30");
assert.equal(parsed.department, "Sales");
assert.equal(parsed.guestKind, "CUSTOMER");
assert.equal(parsed.driverRequired, true);
assert.equal(parsed.visitors[0].fullName, "Ashwin");
assert.equal(parsed.visitors[0].mobile, "0506478022");

const blank = parseXlsxGuestRequest(readFileSync("public/templates/NEWEAST-Guest-Request.xlsx"));
assert.equal(blank, null);

const filledPath = "/tmp/guest-att.xlsx";
try {
  const filled = parseXlsxGuestRequest(readFileSync(filledPath));
  assert.ok(filled);
  assert.equal(filled.visitDate, "2026-09-22");
  assert.equal(filled.arrivalTime, "17:00");
  assert.equal(filled.department, "Sales");
  assert.equal(filled.guestKind, "CUSTOMER");
  assert.equal(filled.visitors[0].fullName, "Ashwin");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

console.log("xlsx-template.check ok");
