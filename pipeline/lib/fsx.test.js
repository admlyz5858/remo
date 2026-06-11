const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { writeJSON, readJSON, runPath } = require("./fsx");

test("writeJSON then readJSON round-trips", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-"));
  const f = path.join(dir, "a.json");
  writeJSON(f, { x: 1 });
  assert.deepStrictEqual(readJSON(f), { x: 1 });
});

test("runPath joins run dir + id + parts", () => {
  assert.strictEqual(runPath("/r", "id1", "topic.json"), path.join("/r", "id1", "topic.json"));
});
