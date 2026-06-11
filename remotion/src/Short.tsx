import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Anton";
import { Scene } from "./components/Scene";
import { OnScreenText } from "./components/OnScreenText";
import { KineticCaptions } from "./components/KineticCaptions";
import { TitleCard } from "./components/TitleCard";
import { ProgressBar } from "./components/ProgressBar";
import type { ShortProps } from "./schema";

const { fontFamily } = loadFont();

export const Short: React.FC<ShortProps> = ({ audioSrc, musicSrc, musicVolume, theme, captions, scenes }) => {
  const ff = theme.fontFamily === "Anton" ? fontFamily : theme.fontFamily;
  const accent = theme.accentColor;
  const hookText = scenes[0]?.onScreenText || "";
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={staticFile(audioSrc)} />
      {musicSrc ? <Audio src={staticFile(musicSrc)} loop volume={musicVolume} /> : null}
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationFrames}>
          <Scene scene={scene} accentColor={accent} />
          {scene.onScreenText ? (
            <OnScreenText text={scene.onScreenText} fontFamily={ff} accentColor={accent} />
          ) : null}
        </Sequence>
      ))}
      {scenes[0] && hookText ? (
        <Sequence from={scenes[0].startFrame} durationInFrames={Math.min(scenes[0].durationFrames, 45)}>
          <TitleCard text={hookText} fontFamily={ff} accentColor={accent} holdFrames={30} />
        </Sequence>
      ) : null}
      <KineticCaptions captions={captions} fontFamily={ff} accentColor={accent} />
      <ProgressBar accentColor={accent} />
    </AbsoluteFill>
  );
};
