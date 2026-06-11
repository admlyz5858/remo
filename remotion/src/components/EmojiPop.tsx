import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from "remotion";
import { popScale } from "../lib/anim";

export const EmojiPop: React.FC<{ emoji: string }> = ({ emoji }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = Math.min(frame / Math.round(fps * 0.4), 1);
  const drift = interpolate(frame, [0, 60], [0, -40]);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 150, paddingRight: 60 }}>
      <div style={{ fontSize: 130, transform: `scale(${popScale(p)}) translateY(${drift}px)` }}>{emoji}</div>
    </AbsoluteFill>
  );
};
