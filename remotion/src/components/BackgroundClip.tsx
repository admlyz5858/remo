import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { Video } from "@remotion/media";

export const BackgroundClip: React.FC<{ src: string }> = ({ src }) => (
  <AbsoluteFill style={{ backgroundColor: "#0b0b12" }}>
    <Video src={staticFile(src)} loop muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(6px) brightness(0.5)" }} />
  </AbsoluteFill>
);
