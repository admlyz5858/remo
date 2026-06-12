import { z } from "zod";

export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number(),
  confidence: z.number().nullable(),
});

export const annotationSchema = z.object({
  box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  label: z.string(),
  type: z.enum(["arrow", "circle"]),
});

export const sceneSchema = z.object({
  id: z.number(),
  onScreenText: z.string().nullable(),
  emoji: z.string().nullable(),
  startFrame: z.number(),
  durationFrames: z.number(),
  media: z.object({ type: z.enum(["video", "image"]), src: z.string() }),
  transition: z.string(),
  annotation: annotationSchema.nullable(),
});

export const themeSchema = z.object({
  accentColor: z.string(),
  fontFamily: z.string(),
  channelName: z.string(),
});

export const shortSchema = z.object({
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  audioSrc: z.string(),
  musicSrc: z.string().nullable(),
  musicVolume: z.number(),
  sfxSrc: z.string().nullable(),
  hookQuestion: z.string().nullable(),
  waitTeaser: z.string().nullable(),
  payoff: z.string().nullable(),
  cta: z.string().nullable(),
  theme: themeSchema,
  captions: z.array(captionSchema),
  scenes: z.array(sceneSchema),
});

export type ShortProps = z.infer<typeof shortSchema>;
export type SceneNode = z.infer<typeof sceneSchema>;
export type CaptionItem = z.infer<typeof captionSchema>;

export const segmentSchema = z.object({
  kind: z.enum(["question", "comment", "cta"]),
  author: z.string().nullable(),
  upvotes: z.string().nullable(),
  text: z.string(),
  startFrame: z.number(),
  durationFrames: z.number(),
});

export const commentsSchema = z.object({
  fps: z.number(), width: z.number(), height: z.number(),
  audioSrc: z.string(),
  musicSrc: z.string().nullable(), musicVolume: z.number(), sfxSrc: z.string().nullable(),
  backgroundSrc: z.string(),
  subreddit: z.string(), question: z.string(),
  theme: themeSchema,
  captions: z.array(captionSchema),
  segments: z.array(segmentSchema),
});
export type CommentsProps = z.infer<typeof commentsSchema>;
export type Segment = z.infer<typeof segmentSchema>;
