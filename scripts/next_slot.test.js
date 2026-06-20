const test = require("node:test");
const assert = require("node:assert");
const { nextSlotIso, SLOTS } = require("./next_slot");

test("facts and money slots never coincide (staggered)", () => {
  const overlap = SLOTS.facts.filter((h) => SLOTS.money.includes(h));
  assert.deepStrictEqual(overlap, [], "facts/money share an hour");
});

test("nextSlotIso returns the next facts slot after the latest scheduled", () => {
  const videos = [{ mode: "facts", publish_at: "2026-06-14T09:00:00Z" }];
  const now = Date.parse("2026-06-13T12:00:00Z");
  // facts slots [9,15]; latest scheduled is 06-14 09:00 -> next facts slot is 06-14 15:00
  assert.strictEqual(nextSlotIso(videos, "facts", now), "2026-06-14T15:00:00.000Z");
});

test("nextSlotIso with no scheduled uses next slot after now", () => {
  const now = Date.parse("2026-06-13T10:00:00Z"); // 09:00 passed -> next facts slot today is 15:00
  assert.strictEqual(nextSlotIso([], "facts", now), "2026-06-13T15:00:00.000Z");
});

test("nextSlotIso money uses the staggered 10:00/16:00 slots", () => {
  const now = Date.parse("2026-06-13T08:00:00Z"); // before 10:00 -> today 10:00
  assert.strictEqual(nextSlotIso([], "money", now), "2026-06-13T10:00:00.000Z");
});
