import assert from "node:assert/strict";
import { mailEnvelope } from "./mail";

const watch = "sakour@neweast.co";
const envelope = mailEnvelope(["Mais Ali <mais@neweast.co>", "reception@neweast.co", "mais@neweast.co"]);
assert.deepEqual(envelope.to, ["mais@neweast.co", "reception@neweast.co"]);
assert.equal(envelope.bcc, watch);

const self = mailEnvelope(watch);
assert.deepEqual(self.to, [watch]);
assert.equal(self.bcc, "");

console.log("mail.check: ok");
