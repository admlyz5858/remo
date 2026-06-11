import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { activeCaptionIndex, popScale } from "../lib/anim";
import type { CaptionItem } from "../schema";

const WINDOW = 3;
const POP_MS = 140;

export const KineticCaptions: React.FC<{ captions: CaptionItem[]; fontFamily: string; accentColor: string }> = ({
  captions, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const active = activeCaptionIndex(captions, ms);
  if (active === -1) return null;

  const start = Math.max(0, active - WINDOW);
  const end = Math.min(captions.length, active + WINDOW + 1);
  const win = captions.slice(start, end);
  const activeCap = captions[active];
  const popP = Math.min(Math.max((ms - activeCap.startMs) / POP_MS, 0), 1);
  const activeScale = 1 + (popScale(popP) - 1) * 0.4;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 360 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, maxWidth: "90%", textAlign: "center" }}>
        {win.map((c, i) => {
          const idx = start + i;
          const isActive = idx === active;
          return (
            <span
              key={idx}
              style={{
                fontFamily, fontWeight: 800, lineHeight: 1.05, fontSize: 74,
                color: isActive ? accentColor : "white",
                transform: `scale(${isActive ? activeScale : 1})`,
                WebkitTextStroke: "4px black",
                paintOrder: "stroke fill",
                textShadow: "0 4px 10px rgba(0,0,0,0.6)",
              }}
            >
              {c.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
