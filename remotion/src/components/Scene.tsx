import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { kenBurnsScale, punchZoom, transitionStyle } from "../lib/anim";
import { MotionBackground } from "./MotionBackground";
import type { SceneNode } from "../schema";

const ENTRANCE_FRAMES = 8;
const PUNCH_FRAMES = 12;

export const Scene: React.FC<{ scene: SceneNode; accentColor: string }> = ({ scene, accentColor }) => {
  const frame = useCurrentFrame(); // Sequence-relative
  const ts = transitionStyle(scene.transition, Math.min(frame / ENTRANCE_FRAMES, 1));
  const punch = punchZoom(Math.min(frame / PUNCH_FRAMES, 1));
  const kb = kenBurnsScale(frame, scene.durationFrames);
  const isImage = scene.media.type === "image";
  const scale = ts.scale * punch * kb;
  const src = staticFile(scene.media.src);

  return (
    <AbsoluteFill style={{ opacity: ts.opacity, backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `translate(${ts.x}%, ${ts.y}%) scale(${scale})` }}>
        {scene.media.type === "video" ? (
          <Video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
        ) : (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </AbsoluteFill>
      {isImage ? <MotionBackground accentColor={accentColor} /> : null}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.85) 100%)" }} />
    </AbsoluteFill>
  );
};
