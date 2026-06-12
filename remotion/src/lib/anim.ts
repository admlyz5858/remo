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

export function parseStat(s: string): { prefix: string; num: number; suffix: string } {
  const m = String(s).trim().match(/^([^0-9.]*)([\d.,]+)\s*([kmb]?)\s*(%?)/i);
  if (!m) return { prefix: "", num: 0, suffix: "" };
  const prefix = m[1] || "";
  const num = parseFloat(m[2].replace(/,/g, "")) || 0;
  const unit = (m[3] || "").toLowerCase();
  const scale = unit === "k" ? 1e3 : unit === "m" ? 1e6 : unit === "b" ? 1e9 : 1;
  return { prefix, num: Math.round(num * scale), suffix: m[4] || "" };
}

export function countValue(target: number, p: number): number {
  const t = Math.min(Math.max(p, 0), 1);
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.round(target * eased);
}

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// points -> "M x0 y0 L x1 y1 ..." normalized to width w, height h (y inverted; min->bottom, max->top)
export function chartPath(points: number[], w: number, h: number): string {
  if (!points.length) return "";
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  return points
    .map((v, i) => {
      const x = Math.round(i * step);
      const y = Math.round(h - ((v - min) / span) * h);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}
