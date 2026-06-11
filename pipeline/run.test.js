const test = require("node:test");
const assert = require("node:assert");
const { makeRunId } = require("./run");

test("makeRunId formats run-YYYYMMDD-HHMMSS from a Date", () => {
  const d = new Date(Date.UTC(2026, 5, 11, 8, 53, 14));
  assert.strictEqual(makeRunId(d), "run-20260611-085314");
});
