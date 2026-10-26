import assert from "node:assert/strict";
import { parseVisitCodeSeq } from "./ids";

function check() {
  assert.equal(parseVisitCodeSeq("GV-2026-000125", 2026), 125);
  assert.equal(parseVisitCodeSeq("GV-2026-000001", 2026), 1);
  assert.equal(parseVisitCodeSeq("GV-2025-000125", 2026), null);
  assert.equal(parseVisitCodeSeq("bad", 2026), null);
  console.log("ids.check: ok");
}

check();
