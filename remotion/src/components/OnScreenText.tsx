import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const OnScreenText: React.FC<{ text: string; fontFamily: string; accentColor: string }> = ({
  text, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(frame, [0, 10], [20, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 180 }}>
      <div
        style={{
          opacity, transform: `translateY(${translateY}px)`,
          fontFamily, fontSize: 84, color: "white", fontWeight: 800,
          textAlign: "center", padding: "12px 28px",
          background: accentColor, borderRadius: 14, maxWidth: "85%",
          textShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
