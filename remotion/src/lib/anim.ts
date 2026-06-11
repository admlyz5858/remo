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
