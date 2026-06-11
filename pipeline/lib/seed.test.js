const test = require("node:test");
const assert = require("node:assert");
const { hashSeed, seededInt, pickFrom, pickMusic } = require("./seed");

test("hashSeed is deterministic and non-negative", () => {
  assert.strictEqual(hashSeed("abc"), hashSeed("abc"));
  assert.ok(hashSeed("abc") >= 0);
  assert.notStrictEqual(hashSeed("abc"), hashSeed("abd"));
});

test("seededInt stays in range and is deterministic", () => {
  const v = seededInt("run-1", 4);
  assert.ok(v >= 0 && v < 4);
  assert.strictEqual(seededInt("run-1", 4), v);
  assert.strictEqual(seededInt("x", 0), 0);
});

test("pickFrom selects deterministically; pickMusic handles empty", () => {
  const arr = ["a", "b", "c"];
  assert.strictEqual(pickFrom("seedX", arr), pickFrom("seedX", arr));
  assert.ok(arr.includes(pickFrom("seedX", arr)));
  assert.strictEqual(pickMusic([], "s"), null);
  assert.strictEqual(pickMusic(["t1.mp3", "t2.mp3"], "s"), pickMusic(["t1.mp3", "t2.mp3"], "s"));
});
