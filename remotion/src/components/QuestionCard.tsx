import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const QuestionCard: React.FC<{ subreddit: string; question: string; fontFamily: string; accentColor: string }> = ({
  subreddit, question, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 12], [-40, 0], { extrapolateRight: "clamp" });
  const o = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 120 }}>
      <div style={{ transform: `translateY(${y}px)`, opacity: o, width: "88%", background: "white", borderRadius: 22, padding: "22px 26px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: accentColor }} />
          <div style={{ fontFamily, fontWeight: 800, fontSize: 30, color: "#1a1a1b" }}>{subreddit}</div>
        </div>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 44, color: "#1a1a1b", lineHeight: 1.15 }}>{question}</div>
      </div>
    </AbsoluteFill>
  );
};
