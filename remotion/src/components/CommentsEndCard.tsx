import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const CommentsEndCard: React.FC<{ channel: string; fontFamily: string; accentColor: string }> = ({ channel, fontFamily, accentColor }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const pulse = 1 + 0.05 * Math.sin(frame / 5);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 64, color: "white", textAlign: "center", WebkitTextStroke: "4px black", paintOrder: "stroke fill", marginBottom: 24 }}>Comment your favorite! 💬</div>
      <div style={{ transform: `scale(${pulse})`, background: "#FF0033", color: "white", fontFamily, fontWeight: 800, fontSize: 46, padding: "12px 40px", borderRadius: 999 }}>▶ FOLLOW for more 😂</div>
      <div style={{ fontFamily, fontSize: 38, color: "white", marginTop: 18, opacity: 0.9 }}>{channel}</div>
    </AbsoluteFill>
  );
};
