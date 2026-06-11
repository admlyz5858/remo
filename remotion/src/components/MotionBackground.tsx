import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const MotionBackground: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 40]);
  const spin = interpolate(frame, [0, durationInFrames], [0, 25]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute", top: `${10 + drift * 0.2}%`, left: "-10%",
        width: 360, height: 360, borderRadius: "50%",
        border: `10px solid ${accentColor}`, opacity: 0.25,
        transform: `rotate(${spin}deg)`,
      }} />
      <div style={{
        position: "absolute", bottom: `${8 + drift * 0.15}%`, right: "-8%",
        width: 280, height: 280, background: accentColor, opacity: 0.18,
        transform: `rotate(${-spin}deg)`,
      }} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)" }} />
    </AbsoluteFill>
  );
};
