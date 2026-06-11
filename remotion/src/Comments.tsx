import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Anton";
import { BackgroundClip } from "./components/BackgroundClip";
import { QuestionCard } from "./components/QuestionCard";
import { CommentCard } from "./components/CommentCard";
import { CommentsEndCard } from "./components/CommentsEndCard";
import { ProgressBar } from "./components/ProgressBar";
import type { CommentsProps } from "./schema";

const { fontFamily } = loadFont();

export const Comments: React.FC<CommentsProps> = ({ audioSrc, musicSrc, musicVolume, backgroundSrc, subreddit, question, theme, segments }) => {
  const ff = theme.fontFamily === "Anton" ? fontFamily : theme.fontFamily;
  const accent = theme.accentColor;
  const lastSeg = segments[segments.length - 1];
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <BackgroundClip src={backgroundSrc} />
      <Audio src={staticFile(audioSrc)} />
      {musicSrc ? <Audio src={staticFile(musicSrc)} loop volume={musicVolume} /> : null}
      <QuestionCard subreddit={subreddit} question={question} fontFamily={ff} accentColor={accent} />
      {segments.map((seg, i) =>
        seg.kind === "comment" ? (
          <Sequence key={i} from={seg.startFrame} durationInFrames={seg.durationFrames}>
            <CommentCard author={seg.author || "u/redditor"} upvotes={seg.upvotes || ""} text={seg.text} fontFamily={ff} accentColor={accent} />
          </Sequence>
        ) : null,
      )}
      {lastSeg ? (
        <Sequence from={lastSeg.startFrame} durationInFrames={lastSeg.durationFrames}>
          <CommentsEndCard channel={theme.channelName} fontFamily={ff} accentColor={accent} />
        </Sequence>
      ) : null}
      <ProgressBar accentColor={accent} />
    </AbsoluteFill>
  );
};
