const test = require("node:test");
const assert = require("node:assert");
const { nextSlotIso } = require("./next_slot");

test("nextSlotIso returns the next facts slot after the latest scheduled", () => {
  const videos = [{ mode: "facts", publish_at: "2026-06-14T09:00:00Z" }];
  const now = Date.parse("2026-06-13T12:00:00Z");
  // latest scheduled is 06-14 09:00 -> next facts slot is 06-14 15:00
  assert.strictEqual(nextSlotIso(videos, "facts", now), "2026-06-14T15:00:00.000Z");
});

test("nextSlotIso with no scheduled uses next slot after now", () => {
  const now = Date.parse("2026-06-13T10:00:00Z"); // next facts slot today is 15:00
  assert.strictEqual(nextSlotIso([], "facts", now), "2026-06-13T15:00:00.000Z");
});
