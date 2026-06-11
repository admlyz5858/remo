import test from "node:test";
import assert from "node:assert";
import { kenBurnsScale, fadeOpacity, activeCaptionIndex } from "./anim";
import { popScale, punchZoom, staggerReveal, transitionStyle } from "./anim";

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

test("popScale overshoots then settles to 1", () => {
  assert.ok(Math.abs(popScale(0) - 0.6) < 1e-9);
  assert.ok(popScale(0.7) > 1.1);
  assert.ok(Math.abs(popScale(1) - 1) < 1e-9);
});

test("punchZoom goes 1.12 -> 1.0", () => {
  assert.ok(Math.abs(punchZoom(0) - 1.12) < 1e-9);
  assert.ok(Math.abs(punchZoom(1) - 1.0) < 1e-9);
});

test("staggerReveal gives per-index 0..1 progress", () => {
  assert.strictEqual(staggerReveal(0, 0, 30, 6), 0);
  assert.strictEqual(staggerReveal(0, 6, 30, 6), 1);
  assert.strictEqual(staggerReveal(2, 6, 30, 6), 0);
});

test("transitionStyle maps variants to numeric transforms", () => {
  assert.deepStrictEqual(transitionStyle("slideLeft", 0), { x: 100, y: 0, scale: 1, opacity: 1 });
  assert.deepStrictEqual(transitionStyle("slideLeft", 1), { x: 0, y: 0, scale: 1, opacity: 1 });
  assert.deepStrictEqual(transitionStyle("slideUp", 0), { x: 0, y: 100, scale: 1, opacity: 1 });
  assert.strictEqual(transitionStyle("zoomIn", 0).scale, 0.8);
  assert.strictEqual(transitionStyle("fade", 0).opacity, 0);
});

import { drawProgress, dashOffsetFor, boxToScreen } from "./anim";

test("drawProgress ramps 0..1 from startFrame over frames", () => {
  assert.strictEqual(drawProgress(10, 10, 8), 0);
  assert.strictEqual(drawProgress(14, 10, 8), 0.5);
  assert.strictEqual(drawProgress(20, 10, 8), 1);
});

test("dashOffsetFor goes length..0", () => {
  assert.strictEqual(dashOffsetFor(100, 0), 100);
  assert.strictEqual(dashOffsetFor(100, 1), 0);
});

test("boxToScreen maps normalized center+size to px", () => {
  const r = boxToScreen({ x: 0.5, y: 0.5, w: 0.2, h: 0.1 }, 1000, 2000);
  assert.strictEqual(r.cx, 500);
  assert.strictEqual(r.cy, 1000);
  assert.strictEqual(r.w, 200);
  assert.strictEqual(r.h, 200);
});
