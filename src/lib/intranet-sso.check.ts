import assert from "node:assert/strict";
import { emailCandidates, readIntranetLink, resolveCompanySchema } from "./intranet-sso";

assert.equal(resolveCompanySchema("BI_NEGT"), "BI_NEGT");
assert.equal(resolveCompanySchema("bi-negt"), "BI_NEGT");
assert.equal(resolveCompanySchema("BAIC"), "BI_NEGT_BAIC");
assert.equal(resolveCompanySchema("unknown-co"), "BI_NEGT");
assert.equal(resolveCompanySchema(""), "BI_NEGT");

assert.deepEqual(emailCandidates("Jad.Sakour@neweast.com"), ["jad.sakour@neweast.com", "jad.sakour@neweast.co"]);
assert.ok(emailCandidates("sakour@neweast.com").includes("sakour@neweast.co"));

assert.equal(readIntranetLink({ userId: "SAP25", otp: "58505", company: "BI_NEGT" })?.userId, "SAP25");
assert.equal(readIntranetLink({ userId: "SAP25", otp: "58505", company: "BI_NEGT" })?.otp, "58505");
assert.equal(readIntranetLink({ userId: "SAP 25", otp: "58505" }), null);
assert.equal(readIntranetLink({ userId: "SAP25", otp: "abc" }), null);
assert.equal(readIntranetLink({ userId: "", otp: "58505" }), null);

console.log("intranet-sso.check: ok");
