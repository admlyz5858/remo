import test from "node:test";
import assert from "node:assert";
import { kenBurnsScale, fadeOpacity, activeCaptionIndex } from "./anim";

test("kenBurnsScale goes 1 → 1.08 across duration", () => {
  assert.strictEqual(kenBurnsScale(0, 100), 1);
  assert.ok(Math.abs(kenBurnsScale(100, 100) - 1.08) < 1e-9);
});

test("fadeOpacity ramps 0→1 over fadeFrames then clamps", () => {
  assert.strictEqual(fadeOpacity(0, 8), 0);
  assert.strictEqual(fadeOpacity(8, 8), 1);
  assert.strictEqual(fadeOpacity(40, 8), 1);
});

test("activeCaptionIndex finds caption covering the ms, else -1", () => {
  const caps = [
    { text: "a", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 },
    { text: "b", startMs: 500, endMs: 1000, timestampMs: 750, confidence: 1 },
  ];
  assert.strictEqual(activeCaptionIndex(caps, 250), 0);
  assert.strictEqual(activeCaptionIndex(caps, 600), 1);
  assert.strictEqual(activeCaptionIndex(caps, 2000), -1);
});
