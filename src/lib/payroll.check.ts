import assert from "node:assert/strict";
import { isCompanyEmail, payrollLoginEmail } from "./payroll";

assert.equal(isCompanyEmail("sachini@neweast.com"), true);
assert.equal(isCompanyEmail("guru@neweast.co"), true);
assert.equal(isCompanyEmail("sachinialwis1993@gmail.com"), false);

assert.equal(
  payrollLoginEmail({
    EmailAddress: "sachinialwis1993@gmail.com",
    EmailType: "H1",
    EmailAddress1: "Sachini@neweast.com",
    EmailType1: "W1",
  }),
  "sachini@neweast.com",
);

assert.equal(
  payrollLoginEmail({
    EmailAddress: "guru@neweast.com",
    EmailType: "W1",
    EmailAddress1: null,
    EmailType1: null,
  }),
  "guru@neweast.co",
);

assert.equal(
  payrollLoginEmail({
    EmailAddress: "only@gmail.com",
    EmailType: "H1",
    EmailAddress1: null,
    EmailType1: null,
  }),
  "only@gmail.com",
);

assert.equal(
  payrollLoginEmail({
    EmailAddress: "work@neweast.com",
    EmailType: "W1",
    EmailAddress1: "home@gmail.com",
    EmailType1: "H1",
  }),
  "work@neweast.com",
);

console.log("payroll.check: ok");
