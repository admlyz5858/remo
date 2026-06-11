import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { popScale, staggerReveal } from "../lib/anim";

export const TitleCard: React.FC<{ text: string; fontFamily: string; accentColor: string; holdFrames: number }> = ({
  text, fontFamily, accentColor, holdFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const fadeOut = interpolate(frame, [holdFrames, holdFrames + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60, opacity: fadeOut }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
        {words.map((w, i) => {
          const p = staggerReveal(i, frame, fps, 4);
          return (
            <span
              key={i}
              style={{
                fontFamily, fontWeight: 800, fontSize: 104, lineHeight: 1.0,
                color: i % 2 === 0 ? "white" : accentColor,
                transform: `scale(${popScale(p)})`,
                opacity: p === 0 ? 0 : 1,
                WebkitTextStroke: "4px black", paintOrder: "stroke fill",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
