import assert from "node:assert/strict";
import { outboundRecipient } from "./notify";
import { teamsGoesToAssignee } from "./teams";

assert.equal(outboundRecipient("guru@neweast.co"), "guru@neweast.co");
assert.equal(outboundRecipient("  mais.alhamwi@neweast.com "), "mais.alhamwi@neweast.com");
assert.equal(outboundRecipient(""), "");
assert.equal(outboundRecipient(null), "");
assert.equal(teamsGoesToAssignee("LINE_APPROVAL", { email: "guru@neweast.co" }), true);
assert.equal(teamsGoesToAssignee("INTAKE_READY", { email: "mais.alhamwi@neweast.com" }), true);
assert.equal(teamsGoesToAssignee("VISIT_UPDATE", { email: "ashwin@neweast.co" }), true);
assert.equal(teamsGoesToAssignee("LINE_APPROVAL", { email: "" }), false);

console.log("notify.check: ok");
