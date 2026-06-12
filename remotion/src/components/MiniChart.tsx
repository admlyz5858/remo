import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { chartPath, drawProgress, dashOffsetFor } from "../lib/anim";

const W = 600, H = 320;

export const MiniChart: React.FC<{ points: number[]; accentColor: string }> = ({ points, accentColor }) => {
  const frame = useCurrentFrame();
  const p = drawProgress(frame, 6, 18);
  if (p <= 0 || points.length < 2) return null;
  const d = chartPath(points, W, H);
  const len = 1600;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 520 }}>
      <svg width={W} height={H + 30} viewBox={`0 0 ${W} ${H + 30}`}>
        <path d={d} fill="none" stroke={accentColor} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={len} strokeDashoffset={dashOffsetFor(len, p)} style={{ filter: `drop-shadow(0 0 12px ${accentColor})` }} />
        {p > 0.85 ? <text x={W - 40} y={20} fill={accentColor} fontSize={64} fontWeight={800}>↗</text> : null}
      </svg>
    </AbsoluteFill>
  );
};
