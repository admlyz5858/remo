import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Anton";
import { Scene } from "./components/Scene";
import { OnScreenText } from "./components/OnScreenText";
import { KineticCaptions } from "./components/KineticCaptions";
import { HookCard } from "./components/HookCard";
import { WaitBadge } from "./components/WaitBadge";
import { EndCard } from "./components/EndCard";
import { EmojiPop } from "./components/EmojiPop";
import { Annotation } from "./components/Annotation";
import { ProgressBar } from "./components/ProgressBar";
import type { ShortProps } from "./schema";

const { fontFamily } = loadFont();

export const Short: React.FC<ShortProps> = ({ audioSrc, musicSrc, musicVolume, theme, captions, scenes, hookQuestion, waitTeaser, payoff, cta, sfxSrc }) => {
  const ff = theme.fontFamily === "Anton" ? fontFamily : theme.fontFamily;
  const accent = theme.accentColor;
  const last = scenes[scenes.length - 1];
  const midIdx = Math.floor(scenes.length / 2);
  const mid = scenes[midIdx];
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={staticFile(audioSrc)} />
      {musicSrc ? <Audio src={staticFile(musicSrc)} loop volume={musicVolume} /> : null}
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationFrames}>
          <Scene scene={scene} accentColor={accent} />
          {scene.onScreenText ? <OnScreenText text={scene.onScreenText} fontFamily={ff} accentColor={accent} /> : null}
          {scene.emoji ? <EmojiPop emoji={scene.emoji} /> : null}
          {scene.annotation && scene.id !== last.id ? <Annotation annotation={scene.annotation} /> : null}
          {scene.annotation && scene.id !== last.id && sfxSrc ? <Audio src={staticFile(sfxSrc)} /> : null}
        </Sequence>
      ))}
      {scenes[0] && hookQuestion ? (
        <Sequence from={scenes[0].startFrame} durationInFrames={Math.min(scenes[0].durationFrames, 50)}>
          <HookCard text={hookQuestion} fontFamily={ff} accentColor={accent} holdFrames={34} />
        </Sequence>
      ) : null}
      {mid && waitTeaser ? (
        <Sequence from={mid.startFrame} durationInFrames={Math.min(mid.durationFrames, 50)}>
          <WaitBadge fontFamily={ff} accentColor={accent} />
        </Sequence>
      ) : null}
      {last && (payoff || cta) ? (
        <Sequence from={last.startFrame} durationInFrames={last.durationFrames}>
          <EndCard payoff={payoff || ""} cta={cta || ""} channel={theme.channelName} fontFamily={ff} accentColor={accent} />
        </Sequence>
      ) : null}
      <KineticCaptions captions={captions} fontFamily={ff} accentColor={accent} />
      <ProgressBar accentColor={accent} />
    </AbsoluteFill>
  );
};
