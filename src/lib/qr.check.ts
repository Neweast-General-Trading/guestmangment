import assert from "node:assert/strict";
import { parseQrPayload } from "./qr";

function check() {
  assert.equal(parseQrPayload("abcToken"), "abcToken");
  assert.equal(
    parseQrPayload("https://guest.neweast.cloud/invite/abcToken"),
    "abcToken",
  );
  assert.equal(
    parseQrPayload("https://guest.neweast.cloud/invite/abcToken/"),
    "abcToken",
  );
  assert.equal(parseQrPayload("  tok  "), "tok");
  assert.equal(parseQrPayload(""), "");
  console.log("qr.check: ok");
}

check();
