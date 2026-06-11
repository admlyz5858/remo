import { z } from "zod";

export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number(),
  confidence: z.number().nullable(),
});

export const sceneSchema = z.object({
  id: z.number(),
  onScreenText: z.string().nullable(),
  startFrame: z.number(),
  durationFrames: z.number(),
  media: z.object({ type: z.enum(["video", "image"]), src: z.string() }),
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
  theme: themeSchema,
  captions: z.array(captionSchema),
  scenes: z.array(sceneSchema),
});

export type ShortProps = z.infer<typeof shortSchema>;
export type SceneNode = z.infer<typeof sceneSchema>;
export type CaptionItem = z.infer<typeof captionSchema>;
