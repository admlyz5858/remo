import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

const SYMBOLS = [
  { t: "AAPL", up: true }, { t: "BTC", up: true }, { t: "TSLA", up: false }, { t: "SPY", up: true },
  { t: "ETH", up: false }, { t: "GOLD", up: true }, { t: "NVDA", up: true }, { t: "OIL", up: false },
];

export const TickerStrip: React.FC<{ fontFamily: string }> = ({ fontFamily }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [0, -1200]);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start" }}>
      <div style={{ marginTop: 40, height: 56, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 48, transform: `translateX(${x}px)`, paddingLeft: 40, whiteSpace: "nowrap" }}>
          {SYMBOLS.concat(SYMBOLS).map((s, i) => (
            <span key={i} style={{ fontFamily, fontWeight: 800, fontSize: 30, color: s.up ? "#16C784" : "#FF5C5C" }}>
              {s.t} {s.up ? "▲" : "▼"}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
