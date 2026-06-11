import type { CaptionItem } from "../schema";

export function kenBurnsScale(frame: number, durationFrames: number): number {
  if (durationFrames <= 0) return 1;
  const t = Math.min(Math.max(frame / durationFrames, 0), 1);
  return 1 + 0.08 * t;
}

export function fadeOpacity(frame: number, fadeFrames: number): number {
  if (fadeFrames <= 0) return 1;
  return Math.min(Math.max(frame / fadeFrames, 0), 1);
}

export function activeCaptionIndex(captions: CaptionItem[], ms: number): number {
  return captions.findIndex((c) => ms >= c.startMs && ms < c.endMs);
}

function clamp01(x: number): number { return Math.min(Math.max(x, 0), 1); }

// p in 0..1 -> scale that rises to ~1.2 overshoot at p=0.7 then settles to 1.0
export function popScale(p: number): number {
  const t = clamp01(p);
  if (t <= 0.7) return 0.6 + (1.2 - 0.6) * (t / 0.7);
  return 1.2 - 0.2 * ((t - 0.7) / 0.3);
}

// p in 0..1 -> scale from 1.12 down to 1.0
export function punchZoom(p: number): number {
  return 1.0 + 0.12 * (1 - clamp01(p));
}

// progress (0..1) of word `index` given the current frame
export function staggerReveal(index: number, frame: number, fps: number, perItemFrames: number): number {
  return clamp01((frame - index * perItemFrames) / perItemFrames);
}

export type TransitionTransform = { x: number; y: number; scale: number; opacity: number };
// p in 0..1 -> entrance transform. x/y are percentages.
export function transitionStyle(variant: string, p: number): TransitionTransform {
  const t = clamp01(p);
  switch (variant) {
    case "slideLeft": return { x: (1 - t) * 100, y: 0, scale: 1, opacity: 1 };
    case "slideUp": return { x: 0, y: (1 - t) * 100, scale: 1, opacity: 1 };
    case "zoomIn": return { x: 0, y: 0, scale: 0.8 + 0.2 * t, opacity: 1 };
    case "fade":
    default: return { x: 0, y: 0, scale: 1, opacity: t };
  }
}

export function drawProgress(frame: number, startFrame: number, frames: number): number {
  if (frames <= 0) return 1;
  return Math.min(Math.max((frame - startFrame) / frames, 0), 1);
}

export function dashOffsetFor(length: number, p: number): number {
  return length * (1 - Math.min(Math.max(p, 0), 1));
}

// box: normalized center (x,y) + size (w,h). Returns pixel center + size.
export function boxToScreen(box: { x: number; y: number; w: number; h: number }, W: number, H: number) {
  return { cx: box.x * W, cy: box.y * H, w: box.w * W, h: box.h * H };
}
