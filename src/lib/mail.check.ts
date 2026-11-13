import assert from "node:assert/strict";
import { mailEnvelope } from "./mail";

const saved = { bcc: process.env.MAIL_BCC, deliver: process.env.MAIL_DELIVER_TO };

// Default: no watch copy at all.
process.env.MAIL_BCC = "";
process.env.MAIL_DELIVER_TO = "";
const plain = mailEnvelope(["Mais Ali <mais@neweast.co>", "reception@neweast.co", "mais@neweast.co"]);
assert.deepEqual(plain.to, ["mais@neweast.co", "reception@neweast.co"]);
assert.equal(plain.bcc, "");

// Opt-in watch copy, skipped when the watcher is already a recipient.
const watch = "watch@neweast.co";
process.env.MAIL_BCC = watch;
const envelope = mailEnvelope(["Mais Ali <mais@neweast.co>", "reception@neweast.co", "mais@neweast.co"]);
assert.deepEqual(envelope.to, ["mais@neweast.co", "reception@neweast.co"]);
assert.equal(envelope.bcc, watch);
const self = mailEnvelope(watch);
assert.deepEqual(self.to, [watch]);
assert.equal(self.bcc, "");

process.env.MAIL_BCC = saved.bcc;
process.env.MAIL_DELIVER_TO = saved.deliver;
console.log("mail.check: ok");
