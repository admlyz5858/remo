import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const CommentCard: React.FC<{ author: string; upvotes: string; text: string; fontFamily: string; accentColor: string }> = ({
  author, upvotes, text, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 10], [60, 0], { extrapolateRight: "clamp" });
  const o = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 40 }}>
      <div style={{ transform: `translateX(${x}px)`, opacity: o, width: "90%", background: "white", borderRadius: 20, padding: "24px 26px", boxShadow: "0 12px 34px rgba(0,0,0,0.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: accentColor }} />
          <div style={{ fontFamily, fontWeight: 800, fontSize: 30, color: "#1a1a1b" }}>{author}</div>
          <div style={{ marginLeft: "auto", fontFamily, fontWeight: 800, fontSize: 30, color: "#ff4500" }}>⬆ {upvotes}</div>
        </div>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 46, color: "#1a1a1b", lineHeight: 1.25 }}>{text}</div>
      </div>
    </AbsoluteFill>
  );
};
