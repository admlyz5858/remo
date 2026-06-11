import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { activeCaptionIndex, popScale } from "../lib/anim";
import type { CaptionItem } from "../schema";

const WINDOW = 4;
const POP_MS = 180;

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
  const activeScale = popScale(popP);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 380 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, maxWidth: "88%", textAlign: "center" }}>
        {win.map((c, i) => {
          const idx = start + i;
          const isActive = idx === active;
          return (
            <span
              key={idx}
              style={{
                position: "relative",
                fontFamily, fontWeight: 800, lineHeight: 1.05,
                fontSize: isActive ? 80 : 64,
                color: isActive ? "#000" : "white",
                opacity: isActive ? 1 : 0.55,
                transform: `scale(${isActive ? activeScale : 0.9}) translateY(${isActive ? -8 : 0}px)`,
                background: isActive ? accentColor : "transparent",
                padding: isActive ? "2px 16px" : "0",
                borderRadius: 12,
                WebkitTextStroke: isActive ? "0px" : "3px black",
                paintOrder: "stroke fill",
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
