import assert from "node:assert/strict";
import { isGuruApprover, teamsGoesToAssignee } from "./teams";

assert.equal(isGuruApprover({ email: "guru@neweast.co", name: "Guru Gopalan" }), true);
assert.equal(isGuruApprover({ email: "sakour@neweast.co", name: "Jad Sakour" }), false);
assert.equal(teamsGoesToAssignee("APPROVAL_REQUIRED", { email: "guru@neweast.co" }), true);
assert.equal(teamsGoesToAssignee("SERVICE_PREP", { email: "guru@neweast.co" }), true);
assert.equal(teamsGoesToAssignee("APPROVAL_REQUIRED", { email: "olga@neweast.co" }), true);
assert.equal(teamsGoesToAssignee("ESCALATION_REQUIRED", { email: "samir.ibrahim@neweast.co" }), true);
assert.equal(teamsGoesToAssignee("LINE_APPROVAL", { email: "" }), false);
assert.equal(teamsGoesToAssignee("VISIT_CONFIRMED", { email: "sakour@neweast.co" }), true);
assert.equal(teamsGoesToAssignee("PARKING_ASSIGNED", { email: "sakour@neweast.co" }), true);
console.log("teams.check: ok");
