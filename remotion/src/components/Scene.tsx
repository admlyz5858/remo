import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { kenBurnsScale, fadeOpacity } from "../lib/anim";
import type { SceneNode } from "../schema";

export const Scene: React.FC<{ scene: SceneNode }> = ({ scene }) => {
  const frame = useCurrentFrame(); // local frame (Sequence-relative)
  const scale = kenBurnsScale(frame, scene.durationFrames);
  const opacity = fadeOpacity(frame, 8);
  const src = staticFile(scene.media.src);
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        {scene.media.type === "video" ? (
          <Video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
        ) : (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
