import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Anton";
import { Scene } from "./components/Scene";
import { OnScreenText } from "./components/OnScreenText";
import { KineticCaptions } from "./components/KineticCaptions";
import { HookCard } from "./components/HookCard";
import { EndCard } from "./components/EndCard";
import { EmojiPop } from "./components/EmojiPop";
import { NumberCounter } from "./components/NumberCounter";
import { MiniChart } from "./components/MiniChart";
import { TickerStrip } from "./components/TickerStrip";
import { ProgressBar } from "./components/ProgressBar";
import type { MoneyProps } from "./schema";

const { fontFamily } = loadFont();

export const Money: React.FC<MoneyProps> = ({ audioSrc, musicSrc, musicVolume, theme, captions, scenes, hookQuestion, payoff, cta }) => {
  const ff = theme.fontFamily === "Anton" ? fontFamily : theme.fontFamily;
  const accent = theme.accentColor;
  const last = scenes[scenes.length - 1];
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={staticFile(audioSrc)} />
      {musicSrc ? <Audio src={staticFile(musicSrc)} loop volume={musicVolume} /> : null}
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationFrames}>
          <Scene scene={scene} accentColor={accent} />
          {scene.chart ? <MiniChart points={scene.chart} accentColor={accent} /> : null}
          {scene.stat ? <NumberCounter value={scene.stat.value} label={scene.stat.label} fontFamily={ff} accentColor={accent} /> : null}
          {scene.onScreenText && !scene.stat ? <OnScreenText text={scene.onScreenText} fontFamily={ff} accentColor={accent} /> : null}
          {scene.emoji ? <EmojiPop emoji={scene.emoji} /> : null}
        </Sequence>
      ))}
      <TickerStrip fontFamily={ff} />
      {scenes[0] && hookQuestion ? (
        <Sequence from={scenes[0].startFrame} durationInFrames={Math.min(scenes[0].durationFrames, 50)}>
          <HookCard text={hookQuestion} fontFamily={ff} accentColor={accent} holdFrames={34} />
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
