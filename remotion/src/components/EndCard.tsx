import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { popScale } from "../lib/anim";

export const EndCard: React.FC<{ payoff: string; cta: string; channel: string; fontFamily: string; accentColor: string }> = ({
  payoff, cta, channel, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const btn = popScale(Math.min(Math.max((frame - 12) / 8, 0), 1)) * (1 + 0.04 * Math.sin(frame / 5));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 56, opacity: appear }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 76, color: "white", textAlign: "center", WebkitTextStroke: "4px black", paintOrder: "stroke fill", marginBottom: 28 }}>{payoff}</div>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 44, color: accentColor, textAlign: "center", marginBottom: 28, WebkitTextStroke: "3px black", paintOrder: "stroke fill" }}>{cta}</div>
      <div style={{ transform: `scale(${btn})`, background: "#FF0033", color: "white", fontFamily, fontWeight: 800, fontSize: 46, padding: "12px 40px", borderRadius: 999 }}>▶ FOLLOW</div>
      <div style={{ fontFamily, fontSize: 38, color: "white", marginTop: 18, opacity: 0.9 }}>{channel}</div>
    </AbsoluteFill>
  );
};
