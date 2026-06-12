import React from "react";
import { Composition } from "remotion";
import { Short } from "./Short";
import { Comments } from "./Comments";
import { Money } from "./Money";
import { shortSchema, type ShortProps } from "./schema";
import { commentsSchema, type CommentsProps } from "./schema";
import { moneySchema, type MoneyProps } from "./schema";

const defaultProps: ShortProps = {
  fps: 30, width: 1080, height: 1920,
  audioSrc: "", musicSrc: null, musicVolume: 0.1,
  theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@channel" },
  captions: [], scenes: [],
};

const commentsDefault: CommentsProps = {
  fps: 30, width: 1080, height: 1920, audioSrc: "", musicSrc: null, musicVolume: 0.1, sfxSrc: null,
  backgroundSrc: "", subreddit: "AskReddit", question: "",
  theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@channel" }, captions: [], segments: [],
};

const moneyDefault: MoneyProps = {
  fps: 30, width: 1080, height: 1920, audioSrc: "", musicSrc: null, musicVolume: 0.1, sfxSrc: null,
  hookQuestion: null, waitTeaser: null, payoff: null, cta: null,
  theme: { accentColor: "#16C784", fontFamily: "Anton", channelName: "@FunHoney" }, captions: [], scenes: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Short"
        component={Short}
        schema={shortSchema}
        defaultProps={defaultProps}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={300}
        calculateMetadata={({ props }) => {
          const total = props.scenes.reduce((a, s) => a + s.durationFrames, 0);
          return { durationInFrames: Math.max(total, 1), fps: props.fps, width: props.width, height: props.height };
        }}
      />
      <Composition
        id="Comments"
        component={Comments}
        schema={commentsSchema}
        defaultProps={commentsDefault}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={300}
        calculateMetadata={({ props }) => {
          const total = props.segments.reduce((a, s) => a + s.durationFrames, 0);
          return { durationInFrames: Math.max(total, 1), fps: props.fps, width: props.width, height: props.height };
        }}
      />
      <Composition
        id="Money"
        component={Money}
        schema={moneySchema}
        defaultProps={moneyDefault}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={300}
        calculateMetadata={({ props }) => {
          const total = props.scenes.reduce((a, s) => a + s.durationFrames, 0);
          return { durationInFrames: Math.max(total, 1), fps: props.fps, width: props.width, height: props.height };
        }}
      />
    </>
  );
};
