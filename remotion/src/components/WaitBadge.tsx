import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const WaitBadge: React.FC<{ fontFamily: string; accentColor: string }> = ({ fontFamily, accentColor }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.06 * Math.sin(frame / 4);
  const inOut = interpolate(frame, [0, 8, 40, 50], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 220, opacity: inOut }}>
      <div style={{ transform: `scale(${pulse})`, background: accentColor, color: "#000", fontFamily, fontWeight: 800, fontSize: 52, padding: "10px 28px", borderRadius: 16 }}>
        WAIT FOR IT 👀
      </div>
    </AbsoluteFill>
  );
};
