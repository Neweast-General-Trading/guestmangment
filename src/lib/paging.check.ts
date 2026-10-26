import assert from "node:assert/strict";
import { matches, pageNumbers, paginate } from "./paging";

assert.equal(matches("Jad Sakour · IT", "sak"), true);
assert.equal(matches("Olga Kameniuk", "xyz"), false);
assert.deepEqual(paginate([1, 2, 3, 4], 1, 2).rows, [1, 2]);
assert.deepEqual(paginate([1, 2, 3, 4], 2, 2).rows, [3, 4]);
assert.equal(paginate([1, 2, 3], 9, 2).page, 2);
assert.equal(paginate([], 1, 10).pages, 1);
assert.deepEqual(pageNumbers(1, 5), [1, 2, 3, 4, 5]);
assert.deepEqual(pageNumbers(1, 12), [1, 2, "…", 12]);
assert.deepEqual(pageNumbers(6, 12), [1, "…", 5, 6, 7, "…", 12]);
assert.deepEqual(pageNumbers(12, 12), [1, "…", 11, 12]);
console.log("paging.check: ok");
