import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { activeCaptionIndex } from "../lib/anim";
import type { CaptionItem } from "../schema";

const WINDOW = 4; // words shown around the active word

export const Captions: React.FC<{ captions: CaptionItem[]; fontFamily: string; accentColor: string }> = ({
  captions, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const active = activeCaptionIndex(captions, ms);
  if (active === -1) return null;

  const start = Math.max(0, active - WINDOW);
  const end = Math.min(captions.length, active + WINDOW + 1);
  const window = captions.slice(start, end);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 360 }}>
      <div
        style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12,
          maxWidth: "88%", textAlign: "center",
        }}
      >
        {window.map((c, i) => {
          const isActive = start + i === active;
          return (
            <span
              key={start + i}
              style={{
                fontFamily, fontSize: 72, fontWeight: 800, lineHeight: 1.1,
                color: isActive ? accentColor : "white",
                opacity: isActive ? 1 : 0.6,
                WebkitTextStroke: "3px black",
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
