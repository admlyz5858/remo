import React from "react";
import { Composition } from "remotion";
import { Short } from "./Short";
import { shortSchema, type ShortProps } from "./schema";

const defaultProps: ShortProps = {
  fps: 30, width: 1080, height: 1920,
  audioSrc: "", theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@channel" },
  captions: [], scenes: [],
};

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
