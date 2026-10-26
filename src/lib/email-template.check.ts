import assert from "node:assert/strict";
import {
  guestRequestTemplate,
  hasGuestTemplate,
  normalizeGuestKind,
  parseGuestTemplate,
  visitTypeFromKind,
} from "./email-template";

const filled = guestRequestTemplate({
  visitDate: "2026-09-24",
  arrivalTime: "10:30",
  department: "Sales",
  guestKind: "CUSTOMER",
  visitorCount: 2,
  driverRequired: true,
  purpose: "Quarterly review at Headquarters",
  visitors: [
    {
      fullName: "Lina Haddad",
      mobile: "0501234567",
      email: "lina@example.com",
      company: "Acme",
      jobTitle: "Buyer",
      nationality: "UAE",
    },
    {
      fullName: "Omar Nasser",
      mobile: "0507654321",
      email: "",
      company: "Acme",
      jobTitle: "",
      nationality: "",
    },
  ],
});

assert.equal(hasGuestTemplate(filled), true);
const parsed = parseGuestTemplate(filled);
assert.ok(parsed);
assert.equal(parsed.visitDate, "2026-09-24");
assert.equal(parsed.arrivalTime, "10:30");
assert.equal(parsed.department, "Sales");
assert.equal(parsed.guestKind, "CUSTOMER");
assert.equal(parsed.driverRequired, true);
assert.equal(parsed.visitors.length, 2);
assert.equal(parsed.visitors[0].fullName, "Lina Haddad");
assert.equal(visitTypeFromKind("GUEST"), "GUEST");
assert.equal(normalizeGuestKind("vip / executive"), "VIP");
assert.equal(parseGuestTemplate("hello without markers"), null);
console.log("email-template.check ok");
