import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { parseStat, countValue, formatCount, popScale } from "../lib/anim";

export const NumberCounter: React.FC<{ value: string; label: string; fontFamily: string; accentColor: string }> = ({
  value, label, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { prefix, num, suffix } = parseStat(value);
  const p = Math.min(frame / Math.round(fps * 1.2), 1);
  const shown = countValue(num, p);
  const pop = popScale(Math.min(frame / 8, 1));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${pop})`, textAlign: "center" }}>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 120, color: accentColor, WebkitTextStroke: "5px black", paintOrder: "stroke fill" }}>
          {prefix}{formatCount(shown)}{suffix} 💰
        </div>
        {label ? <div style={{ fontFamily, fontWeight: 800, fontSize: 40, color: "white", marginTop: 8, WebkitTextStroke: "3px black", paintOrder: "stroke fill" }}>{label}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
