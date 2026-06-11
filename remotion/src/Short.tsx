import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Anton";
import { Scene } from "./components/Scene";
import { OnScreenText } from "./components/OnScreenText";
import { Captions } from "./components/Captions";
import { ProgressBar } from "./components/ProgressBar";
import type { ShortProps } from "./schema";

const { fontFamily } = loadFont();

export const Short: React.FC<ShortProps> = ({ audioSrc, theme, captions, scenes }) => {
  const ff = theme.fontFamily === "Anton" ? fontFamily : theme.fontFamily;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={staticFile(audioSrc)} />
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationFrames}>
          <Scene scene={scene} />
          {scene.onScreenText ? (
            <OnScreenText text={scene.onScreenText} fontFamily={ff} accentColor={theme.accentColor} />
          ) : null}
        </Sequence>
      ))}
      <Captions captions={captions} fontFamily={ff} accentColor={theme.accentColor} />
      <ProgressBar accentColor={theme.accentColor} />
    </AbsoluteFill>
  );
};
