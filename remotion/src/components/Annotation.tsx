import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { drawProgress, dashOffsetFor, boxToScreen } from "../lib/anim";
import type { SceneNode } from "../schema";

const W = 1080, H = 1920, DRAW_FRAMES = 8, RED = "#FF2222";

export const Annotation: React.FC<{ annotation: NonNullable<SceneNode["annotation"]> }> = ({ annotation }) => {
  const frame = useCurrentFrame();
  const p = drawProgress(frame, 4, DRAW_FRAMES);
  if (p <= 0) return null;
  const { cx, cy, w, h } = boxToScreen(annotation.box, W, H);
  const r = Math.max(Math.max(w, h) / 2, 90);

  return (
    <AbsoluteFill>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute" }}>
        {annotation.type === "circle" ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={RED} strokeWidth={10}
            strokeDasharray={2 * Math.PI * r} strokeDashoffset={dashOffsetFor(2 * Math.PI * r, p)} strokeLinecap="round" />
        ) : (
          (() => {
            const x1 = cx - 260, y1 = cy - 300, x2 = cx - r * 0.7, y2 = cy - r * 0.7;
            const len = Math.hypot(x2 - x1, y2 - y1);
            return (
              <g stroke={RED} strokeWidth={12} fill="none" strokeLinecap="round">
                <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={len} strokeDashoffset={dashOffsetFor(len, p)} />
                {p > 0.7 ? (<>
                  <line x1={x2} y1={y2} x2={x2 - 34} y2={y2 - 6} />
                  <line x1={x2} y1={y2} x2={x2 - 6} y2={y2 - 34} />
                </>) : null}
              </g>
            );
          })()
        )}
      </svg>
      {p > 0.6 ? (
        <div style={{ position: "absolute", left: cx - 120, top: cy + r + 10, width: 240, textAlign: "center", color: "white", background: RED, fontWeight: 800, fontSize: 34, padding: "4px 10px", borderRadius: 10 }}>
          {annotation.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
