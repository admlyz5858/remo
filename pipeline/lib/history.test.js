const test = require("node:test");
const assert = require("node:assert");
const { isDuplicate, addEntry, recentTopics } = require("./history");

const hist = { entries: [
  { slug: "octopus-three-hearts", topic: "Octopus hearts", status: "published" },
  { slug: "honey-never-spoils", topic: "Honey never spoils", status: "rejected" },
]};

test("isDuplicate matches by slug case-insensitively", () => {
  assert.strictEqual(isDuplicate(hist, "Octopus-Three-Hearts"), true);
  assert.strictEqual(isDuplicate(hist, "new-slug"), false);
});

test("recentTopics returns topic strings", () => {
  assert.deepStrictEqual(recentTopics(hist), ["Octopus hearts", "Honey never spoils"]);
});

test("addEntry appends without mutating input", () => {
  const next = addEntry(hist, { slug: "x", topic: "X", status: "pending" });
  assert.strictEqual(next.entries.length, 3);
  assert.strictEqual(hist.entries.length, 2);
});
