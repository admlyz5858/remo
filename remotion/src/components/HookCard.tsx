import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { popScale, staggerReveal } from "../lib/anim";

export const HookCard: React.FC<{ text: string; fontFamily: string; accentColor: string; holdFrames: number }> = ({
  text, fontFamily, accentColor, holdFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const fade = interpolate(frame, [holdFrames, holdFrames + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badge = popScale(staggerReveal(0, frame, fps, 5));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 56, opacity: fade }}>
      <div style={{ transform: `scale(${badge})`, background: accentColor, color: "#000", fontFamily, fontWeight: 800, fontSize: 40, padding: "6px 22px", borderRadius: 999, marginBottom: 24 }}>
        🤔 GUESS?
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: 28, rowGap: 8 }}>
        {words.map((w, i) => {
          const p = staggerReveal(i, frame, fps, 4);
          return (
            <span key={i} style={{ fontFamily, fontWeight: 800, fontSize: 84, lineHeight: 1.0, color: "white", transform: `scale(${popScale(p)})`, opacity: p === 0 ? 0 : 1, WebkitTextStroke: "4px black", paintOrder: "stroke fill" }}>{w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
