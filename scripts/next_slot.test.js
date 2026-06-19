const test = require("node:test");
const assert = require("node:assert");
const { nextSlotIso } = require("./next_slot");

test("nextSlotIso returns the next facts slot after the latest scheduled", () => {
  const videos = [{ mode: "facts", publish_at: "2026-06-14T09:00:00Z" }];
  const now = Date.parse("2026-06-13T12:00:00Z");
  // one slot/day (09:00); latest scheduled is 06-14 09:00 -> next facts slot is 06-15 09:00
  assert.strictEqual(nextSlotIso(videos, "facts", now), "2026-06-15T09:00:00.000Z");
});

test("nextSlotIso with no scheduled uses next slot after now", () => {
  const now = Date.parse("2026-06-13T10:00:00Z"); // 09:00 already passed -> next facts slot is tomorrow 09:00
  assert.strictEqual(nextSlotIso([], "facts", now), "2026-06-14T09:00:00.000Z");
});

test("nextSlotIso money uses the single 11:00 slot", () => {
  const now = Date.parse("2026-06-13T08:00:00Z"); // before 11:00 -> today 11:00
  assert.strictEqual(nextSlotIso([], "money", now), "2026-06-13T11:00:00.000Z");
});
