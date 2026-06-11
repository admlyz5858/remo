# remo Pro Content + AI-Vision Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add engagement hooks (guess question, "wait for it", payoff + comment/follow CTA), a cleaner "blend" visual style with emoji pops, and AI-vision drawn annotations (red arrow/circle pointing at the described subject) with sound effects — turning the Short from amateur stock montage into a professional explainer.

**Architecture:** Pipeline stays the staged JSON pipeline. Stage 02 emits hook/wait/payoff/cta + per-scene emoji + an `annotate` flag. A new stage `05c-annotate` extracts a frame per flagged scene and asks Gemini Vision for the subject's normalized center+size; results feed `buildInputProps` and the Remotion `Annotation` component (SVG stroke draw-in) plus a synced SFX `<Audio>`. All seeded choices computed in the pipeline; Remotion is a pure function of props. Two phases: **Phase 1** (content hooks + blend visuals, renderable on its own) and **Phase 2** (vision annotations + SFX).

**Tech Stack:** Node 20 CommonJS + `node:test`, Remotion 4.x (`@remotion/media`), Zod, ffmpeg, Gemini Vision REST (`GEMINI_API_KEY`), edge-tts. No new npm dependency.

---

## Data contracts (locked)

`scenes.json` (stage 02) gains top-level `hook_question`, `wait_teaser`, `payoff`, `cta` (short strings) and per-scene `emoji` (string|null), `annotate` (bool), `visual_query_alt` (exists).

`annotations.json` (stage 05c): `[{ sceneId, box: { x, y, w, h }, label, type: "arrow"|"circle" }]` where **x,y = normalized CENTER (0-1)** of the subject, **w,h = normalized size (0-1)**.

Remotion `inputProps` (built by `buildInputProps`) gains:
```json
{ "hookQuestion": "string|null", "waitTeaser": "string|null",
  "payoff": "string|null", "cta": "string|null", "sfxSrc": "<id>/sfx.mp3|null",
  "scenes": [ { "...": "...", "emoji": "string|null",
    "annotation": { "box": {"x":0,"y":0,"w":0,"h":0}, "label": "string", "type": "arrow|circle" } | null } ] }
```

---

# PHASE 1 — Content hooks + blend visuals (renderable)

### Task 1: Stage 02 — hook/wait/payoff/cta + emoji + annotate

**Files:**
- Modify: `pipeline/02-script.js`
- Modify: `pipeline/02-script.test.js`

- [ ] **Step 1: Update the test** — in `pipeline/02-script.test.js`, replace the `fakeChat` return with:
```js
  const fakeChat = async () => ({
    hook: "Octopuses have THREE hearts.",
    cta: "Follow for more.",
    hook_question: "Which has 3 hearts — octopus or squid?",
    wait_teaser: "But the weird part is next.",
    payoff: "Yep — octopuses have three hearts!",
    scenes: [
      { id: 1, narration: "Octopuses have three hearts.", visual_query: "octopus closeup", visual_query_alt: "deep ocean", on_screen_text: "3 HEARTS", emoji: "🐙", annotate: true },
      { id: 2, narration: "Two pump blood to the gills.", visual_query: "octopus gills macro", visual_query_alt: "octopus swimming", on_screen_text: null, emoji: "❤️", annotate: false },
    ],
    title: "Why Octopuses Have 3 Hearts #shorts",
    description: "A quick fact.",
    tags: ["octopus", "shorts"],
  });
```
And after the existing assertions add:
```js
  assert.strictEqual(scenes.hook_question, "Which has 3 hearts — octopus or squid?");
  assert.strictEqual(scenes.wait_teaser, "But the weird part is next.");
  assert.strictEqual(scenes.payoff, "Yep — octopuses have three hearts!");
  assert.strictEqual(scenes.scenes[0].emoji, "🐙");
  assert.strictEqual(scenes.scenes[0].annotate, true);
  assert.strictEqual(scenes.scenes[1].annotate, false);
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/02-script.test.js`
Expected: FAIL — `scenes.hook_question` undefined.

- [ ] **Step 3: Implement** — in `pipeline/02-script.js`:

Replace `SYSTEM` with:
```js
const SYSTEM = `You are a YouTube Shorts scriptwriter. Write a 40-50 second English voiceover, 3-6 scenes, in this engagement structure:
- Scene 1 narration OPENS with a curiosity/guess question.
- Somewhere in the middle, a "wait for it" style bridge.
- The LAST scene narration delivers the payoff (answer) and a call to action (ask viewers to comment + follow).
Rules: 2nd person, short punchy sentences, numbers spelled where it helps TTS.
Respond ONLY JSON: {hook, hook_question, wait_teaser, payoff, cta, scenes:[{id, narration, visual_query, visual_query_alt, on_screen_text, emoji, annotate}], title, description, tags}.
- hook_question: short on-screen guess question. wait_teaser: short "wait for it" line. payoff: short answer line. cta: short comment+follow line.
- Each scene visual_query MUST be DISTINCT and specific (2-4 English words for a concrete filmable shot, e.g. "octopus gills macro"). visual_query_alt: a different backup query.
- on_screen_text: short punchy caption or null. emoji: ONE relevant emoji or null. annotate: true for the 1-2 scenes that show a concrete object worth pointing at, else false.
- title <= 90 chars ending with " #shorts". tags = 10-20 strings including "shorts".`;
```

Replace the persisted `scenes` object construction with:
```js
  const scenes = {
    hook: out.hook,
    cta: out.cta,
    hook_question: out.hook_question || null,
    wait_teaser: out.wait_teaser || null,
    payoff: out.payoff || null,
    audio_path: "audio/voiceover.mp3",
    total_duration_sec: 0,
    scenes: out.scenes.map((s) => ({
      id: s.id, narration: s.narration,
      visual_query: s.visual_query,
      visual_query_alt: s.visual_query_alt || null,
      on_screen_text: s.on_screen_text || null,
      emoji: s.emoji || null,
      annotate: !!s.annotate,
      duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0,
    })),
  };
```
(Leave the `meta` construction and writes unchanged.)

- [ ] **Step 4: Run to verify pass**

Run: `node --test pipeline/02-script.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/02-script.js pipeline/02-script.test.js
git commit -m "feat: stage 02 engagement hooks + emoji + annotate flags"
```

---

### Task 2: buildInputProps — hooks, emoji, annotation, sfx params

**Files:**
- Modify: `pipeline/lib/timeline.js`
- Modify: `pipeline/lib/timeline.test.js`

- [ ] **Step 1: Update the test** — replace the `buildInputProps` test in `pipeline/lib/timeline.test.js` with:
```js
test("buildInputProps emits hooks, emoji, annotation + sfx", () => {
  const scenesDoc = {
    hook_question: "Guess?", wait_teaser: "Wait...", payoff: "Answer!",
    cta: "Comment + follow",
    scenes: [
      { id: 1, on_screen_text: "A", duration_sec: 2.0, emoji: "🐙" },
      { id: 2, on_screen_text: null, duration_sec: 1.0, emoji: null },
    ],
  };
  const media = [ { sceneId: 1, type: "video", file: "scene_01.mp4" },
                  { sceneId: 2, type: "image", file: "scene_02.jpg" } ];
  const annotations = [{ sceneId: 1, box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "heart", type: "circle" }];
  const props = buildInputProps({
    runId: "r1", scenesDoc, media, captions: [],
    theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@c" },
    fps: 30, seed: "r1", accentPalette: ["#111", "#222"], transitions: ["slideLeft", "fade"],
    musicSrc: "r1/music.mp3", musicVolume: 0.1, annotations, sfxSrc: "r1/sfx.mp3",
  });
  assert.strictEqual(props.hookQuestion, "Guess?");
  assert.strictEqual(props.waitTeaser, "Wait...");
  assert.strictEqual(props.payoff, "Answer!");
  assert.strictEqual(props.cta, "Comment + follow");
  assert.strictEqual(props.sfxSrc, "r1/sfx.mp3");
  assert.strictEqual(props.scenes[0].emoji, "🐙");
  assert.strictEqual(props.scenes[1].emoji, null);
  assert.deepStrictEqual(props.scenes[0].annotation, { box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "heart", type: "circle" });
  assert.strictEqual(props.scenes[1].annotation, null);
});

test("buildInputProps defaults annotations/sfx when omitted", () => {
  const scenesDoc = { scenes: [{ id: 1, on_screen_text: null, duration_sec: 1.0 }] };
  const props = buildInputProps({
    runId: "r1", scenesDoc, media: [], captions: [],
    theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@c" },
    fps: 30, seed: "r1", accentPalette: ["#111"], transitions: ["fade"],
  });
  assert.strictEqual(props.sfxSrc, null);
  assert.strictEqual(props.scenes[0].annotation, null);
  assert.strictEqual(props.hookQuestion, null);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/lib/timeline.test.js`
Expected: FAIL — `props.hookQuestion` undefined.

- [ ] **Step 3: Implement** — replace `buildInputProps` in `pipeline/lib/timeline.js` with:
```js
function buildInputProps({ runId, scenesDoc, media, captions, theme, fps, seed, accentPalette, transitions, musicSrc, musicVolume, annotations = [], sfxSrc = null }) {
  const byId = new Map(media.map((m) => [m.sceneId, m]));
  const annById = new Map((annotations || []).map((a) => [a.sceneId, a]));
  const accentColor = pickFrom(seed, accentPalette);
  let frame = 0;
  const scenes = scenesDoc.scenes.map((s) => {
    const durationFrames = Math.round(s.duration_sec * fps);
    const m = byId.get(s.id);
    const a = annById.get(s.id);
    const node = {
      id: s.id,
      onScreenText: s.on_screen_text || null,
      emoji: s.emoji || null,
      startFrame: frame,
      durationFrames,
      media: m ? { type: m.type, src: `${runId}/${m.file}` } : { type: "image", src: "" },
      transition: pickFrom(`${seed}:${s.id}`, transitions),
      annotation: a ? { box: a.box, label: a.label, type: a.type } : null,
    };
    frame += durationFrames;
    return node;
  });
  return {
    fps, width: 1080, height: 1920,
    audioSrc: `${runId}/voiceover.mp3`,
    musicSrc: musicSrc || null,
    musicVolume,
    sfxSrc: sfxSrc || null,
    hookQuestion: scenesDoc.hook_question || null,
    waitTeaser: scenesDoc.wait_teaser || null,
    payoff: scenesDoc.payoff || null,
    cta: scenesDoc.cta || null,
    theme: { ...theme, accentColor },
    captions, scenes,
  };
}
```
(`musicVolume` may be undefined in the defaults test — that's fine; it passes through. Leave `applyTimings`/`assembleCaptions` unchanged.)

- [ ] **Step 4: Run to verify pass + full suite**

Run: `node --test pipeline/lib/timeline.test.js` → PASS.
Run: `node --test "pipeline/**/*.test.js"` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/timeline.js pipeline/lib/timeline.test.js
git commit -m "feat: buildInputProps emits hooks/emoji/annotation/sfx"
```

---

### Task 3: schema — new inputProps fields

**Files:**
- Modify: `remotion/src/schema.ts`

- [ ] **Step 1: Implement** (CI type-checks; do not run tsc locally)

Replace `sceneSchema` with:
```ts
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
```

Replace `shortSchema` with:
```ts
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
```

- [ ] **Step 2: Structural check**

Run: `node -e "const s=require('node:fs').readFileSync('remotion/src/schema.ts','utf8'); ['hookQuestion','sfxSrc','annotationSchema','emoji: z.string'].forEach(k=>{if(!s.includes(k))throw new Error(k)}); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/schema.ts
git commit -m "feat: schema adds hooks/emoji/annotation/sfx fields"
```

---

### Task 4: KineticCaptions — cleaner bold (reference style)

**Files:**
- Modify: `remotion/src/components/KineticCaptions.tsx`

- [ ] **Step 1: Implement** — replace the file with:
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { activeCaptionIndex, popScale } from "../lib/anim";
import type { CaptionItem } from "../schema";

const WINDOW = 3;
const POP_MS = 140;

export const KineticCaptions: React.FC<{ captions: CaptionItem[]; fontFamily: string; accentColor: string }> = ({
  captions, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const active = activeCaptionIndex(captions, ms);
  if (active === -1) return null;

  const start = Math.max(0, active - WINDOW);
  const end = Math.min(captions.length, active + WINDOW + 1);
  const win = captions.slice(start, end);
  const activeCap = captions[active];
  const popP = Math.min(Math.max((ms - activeCap.startMs) / POP_MS, 0), 1);
  const activeScale = 1 + (popScale(popP) - 1) * 0.4; // subtler than before

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 360 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, maxWidth: "90%", textAlign: "center" }}>
        {win.map((c, i) => {
          const idx = start + i;
          const isActive = idx === active;
          return (
            <span
              key={idx}
              style={{
                fontFamily, fontWeight: 800, lineHeight: 1.05, fontSize: 74,
                color: isActive ? accentColor : "white",
                transform: `scale(${isActive ? activeScale : 1})`,
                WebkitTextStroke: "4px black",
                paintOrder: "stroke fill",
                textShadow: "0 4px 10px rgba(0,0,0,0.6)",
              }}
            >
              {c.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Structural check**

Run: `node -e "require('node:fs').readFileSync('remotion/src/components/KineticCaptions.tsx','utf8').includes('textShadow')||process.exit(1);console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/components/KineticCaptions.tsx
git commit -m "feat: cleaner bold captions (reference style)"
```

---

### Task 5: HookCard, WaitBadge, EndCard, EmojiPop

**Files:**
- Create: `remotion/src/components/HookCard.tsx`
- Create: `remotion/src/components/WaitBadge.tsx`
- Create: `remotion/src/components/EndCard.tsx`
- Create: `remotion/src/components/EmojiPop.tsx`

- [ ] **Step 1: HookCard.tsx**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { popScale, staggerReveal } from "../lib/anim";

export const HookCard: React.FC<{ text: string; fontFamily: string; accentColor: string; holdFrames: number }> = ({
  text, fontFamily, accentColor, holdFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const fade = interpolate(frame, [holdFrames, holdFrames + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badge = popScale(staggerReveal(0, frame, fps, 5));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 56, opacity: fade }}>
      <div style={{ transform: `scale(${badge})`, background: accentColor, color: "#000", fontFamily, fontWeight: 800, fontSize: 40, padding: "6px 22px", borderRadius: 999, marginBottom: 24 }}>
        🤔 GUESS?
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
        {words.map((w, i) => {
          const p = staggerReveal(i, frame, fps, 4);
          return (
            <span key={i} style={{ fontFamily, fontWeight: 800, fontSize: 84, lineHeight: 1.0, color: "white", transform: `scale(${popScale(p)})`, opacity: p === 0 ? 0 : 1, WebkitTextStroke: "4px black", paintOrder: "stroke fill" }}>{w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: WaitBadge.tsx**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const WaitBadge: React.FC<{ fontFamily: string; accentColor: string }> = ({ fontFamily, accentColor }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.06 * Math.sin(frame / 4);
  const inOut = interpolate(frame, [0, 8, 40, 50], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 220, opacity: inOut }}>
      <div style={{ transform: `scale(${pulse})`, background: accentColor, color: "#000", fontFamily, fontWeight: 800, fontSize: 52, padding: "10px 28px", borderRadius: 16, WebkitTextStroke: "0px" }}>
        WAIT FOR IT 👀
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: EndCard.tsx**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { popScale } from "../lib/anim";

export const EndCard: React.FC<{ payoff: string; cta: string; channel: string; fontFamily: string; accentColor: string }> = ({
  payoff, cta, channel, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const btn = popScale(Math.min(Math.max((frame - 12) / 8, 0), 1)) * (1 + 0.04 * Math.sin(frame / 5));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 56, opacity: appear }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 76, color: "white", textAlign: "center", WebkitTextStroke: "4px black", paintOrder: "stroke fill", marginBottom: 28 }}>{payoff}</div>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 44, color: accentColor, textAlign: "center", marginBottom: 28, WebkitTextStroke: "3px black", paintOrder: "stroke fill" }}>{cta}</div>
      <div style={{ transform: `scale(${btn})`, background: "#FF0033", color: "white", fontFamily, fontWeight: 800, fontSize: 46, padding: "12px 40px", borderRadius: 999 }}>▶ FOLLOW</div>
      <div style={{ fontFamily, fontSize: 38, color: "white", marginTop: 18, opacity: 0.9 }}>{channel}</div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: EmojiPop.tsx**
```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from "remotion";
import { popScale } from "../lib/anim";

export const EmojiPop: React.FC<{ emoji: string }> = ({ emoji }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = Math.min(frame / Math.round(fps * 0.4), 1);
  const drift = interpolate(frame, [0, 60], [0, -40]);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 150, paddingRight: 60 }}>
      <div style={{ fontSize: 130, transform: `scale(${popScale(p)}) translateY(${drift}px)` }}>{emoji}</div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 5: Structural check + commit**

Run: `node -e "['HookCard','WaitBadge','EndCard','EmojiPop'].forEach(n=>{require('node:fs').readFileSync('remotion/src/components/'+n+'.tsx','utf8')}); console.log('OK')"`
Expected: `OK`.
```bash
git add remotion/src/components/HookCard.tsx remotion/src/components/WaitBadge.tsx remotion/src/components/EndCard.tsx remotion/src/components/EmojiPop.tsx
git commit -m "feat: HookCard, WaitBadge, EndCard, EmojiPop"
```

---

### Task 6: Short — wire cards + emoji (Phase 1)

**Files:**
- Modify: `remotion/src/Short.tsx`

- [ ] **Step 1: Implement** — replace the file with:
```tsx
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
import { ProgressBar } from "./components/ProgressBar";
import type { ShortProps } from "./schema";

const { fontFamily } = loadFont();

export const Short: React.FC<ShortProps> = ({ audioSrc, musicSrc, musicVolume, theme, captions, scenes, hookQuestion, waitTeaser, payoff, cta }) => {
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
```
NOTE: the `TitleCard` import/use is removed (replaced by `HookCard`). Leave `remotion/src/components/TitleCard.tsx` on disk (unused, harmless) OR delete it; do not break other imports.

- [ ] **Step 2: Structural check**

Run: `node -e "const s=require('node:fs').readFileSync('remotion/src/Short.tsx','utf8'); ['HookCard','WaitBadge','EndCard','EmojiPop','hookQuestion','payoff'].forEach(k=>{if(!s.includes(k))throw new Error(k)}); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Run full pipeline suite + commit**

Run: `node --test "pipeline/**/*.test.js"` → all PASS.
```bash
git add remotion/src/Short.tsx
git commit -m "feat: Short wires HookCard/WaitBadge/EndCard/EmojiPop"
```

---

# PHASE 2 — AI-vision annotations + SFX

### Task 7: anim — draw/dash/box helpers

**Files:**
- Modify: `remotion/src/lib/anim.ts`
- Modify: `remotion/src/lib/anim.test.ts`

- [ ] **Step 1: Add failing tests** (append):
```ts
import { drawProgress, dashOffsetFor, boxToScreen } from "./anim";

test("drawProgress ramps 0..1 from startFrame over frames", () => {
  assert.strictEqual(drawProgress(10, 10, 8), 0);
  assert.strictEqual(drawProgress(14, 10, 8), 0.5);
  assert.strictEqual(drawProgress(20, 10, 8), 1);
});

test("dashOffsetFor goes length..0", () => {
  assert.strictEqual(dashOffsetFor(100, 0), 100);
  assert.strictEqual(dashOffsetFor(100, 1), 0);
});

test("boxToScreen maps normalized center+size to px", () => {
  const r = boxToScreen({ x: 0.5, y: 0.5, w: 0.2, h: 0.1 }, 1000, 2000);
  assert.strictEqual(r.cx, 500);
  assert.strictEqual(r.cy, 1000);
  assert.strictEqual(r.w, 200);
  assert.strictEqual(r.h, 200); // h uses width*0.1*... -> see impl; just assert numeric
});
```
(If the `r.h` exact value differs, set the assertion to match the implementation in Step 2 — compute `0.1*2000=200`.)

- [ ] **Step 2: Run to verify fail** — `cd remotion && npm test` (CI) or mirror in `~/anim_check.cjs`. Expected: FAIL.

- [ ] **Step 3: Implement** (append to `remotion/src/lib/anim.ts`):
```ts
export function drawProgress(frame: number, startFrame: number, frames: number): number {
  if (frames <= 0) return 1;
  return Math.min(Math.max((frame - startFrame) / frames, 0), 1);
}

export function dashOffsetFor(length: number, p: number): number {
  return length * (1 - Math.min(Math.max(p, 0), 1));
}

// box: normalized center (x,y) + size (w,h). Returns pixel center + size.
export function boxToScreen(box: { x: number; y: number; w: number; h: number }, W: number, H: number) {
  return { cx: box.x * W, cy: box.y * H, w: box.w * W, h: box.h * H };
}
```

- [ ] **Step 4: Verify pass** — `cd remotion && npm test` (CI) or `node ~/anim_check.cjs && echo MATH_OK`. Adjust the `r.h` assertion to the actual (`0.1*2000=200`).

- [ ] **Step 5: Commit**
```bash
git add remotion/src/lib/anim.ts remotion/src/lib/anim.test.ts
git commit -m "feat: anim draw/dash/box helpers for annotations"
```

---

### Task 8: Annotation component (drawn arrow/circle)

**Files:**
- Create: `remotion/src/components/Annotation.tsx`

- [ ] **Step 1: Implement**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { drawProgress, dashOffsetFor, boxToScreen } from "../lib/anim";
import type { SceneNode } from "../schema";

const W = 1080, H = 1920, DRAW_FRAMES = 8, RED = "#FF2222";

export const Annotation: React.FC<{ annotation: NonNullable<SceneNode["annotation"]> }> = ({ annotation }) => {
  const frame = useCurrentFrame();
  const p = drawProgress(frame, 4, DRAW_FRAMES);
  if (p <= 0) return null;
  const { cx, cy, w, h } = boxToScreen(annotation.box, W, H);
  const r = Math.max(Math.max(w, h) / 2, 90);

  return (
    <AbsoluteFill>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute" }}>
        {annotation.type === "circle" ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={RED} strokeWidth={10}
            strokeDasharray={2 * Math.PI * r} strokeDashoffset={dashOffsetFor(2 * Math.PI * r, p)} strokeLinecap="round" />
        ) : (
          (() => {
            const x1 = cx - 260, y1 = cy - 300, x2 = cx - r * 0.7, y2 = cy - r * 0.7;
            const len = Math.hypot(x2 - x1, y2 - y1);
            return (
              <g stroke={RED} strokeWidth={12} fill="none" strokeLinecap="round">
                <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={len} strokeDashoffset={dashOffsetFor(len, p)} />
                {p > 0.7 ? (<>
                  <line x1={x2} y1={y2} x2={x2 - 34} y2={y2 - 6} />
                  <line x1={x2} y1={y2} x2={x2 - 6} y2={y2 - 34} />
                </>) : null}
              </g>
            );
          })()
        )}
      </svg>
      {p > 0.6 ? (
        <div style={{ position: "absolute", left: cx - 120, top: cy + r + 10, width: 240, textAlign: "center", color: "white", background: RED, fontWeight: 800, fontSize: 34, padding: "4px 10px", borderRadius: 10 }}>
          {annotation.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Structural check + commit**

Run: `node -e "const s=require('node:fs').readFileSync('remotion/src/components/Annotation.tsx','utf8'); ['boxToScreen','strokeDashoffset','annotation.type'].forEach(k=>{if(!s.includes(k))throw new Error(k)});console.log('OK')"`
```bash
git add remotion/src/components/Annotation.tsx
git commit -m "feat: drawn arrow/circle annotation component"
```

---

### Task 9: vision.js — Gemini subject detection

**Files:**
- Create: `pipeline/lib/vision.js`
- Test: `pipeline/lib/vision.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const { parseBox, detectSubject } = require("./vision");

test("parseBox clamps to 0..1 and falls back to center", () => {
  assert.deepStrictEqual(parseBox({ box: { x: 1.5, y: -0.2, w: 0.3, h: 0.3 }, label: "x" }),
    { box: { x: 1, y: 0, w: 0.3, h: 0.3 }, label: "x" });
  assert.deepStrictEqual(parseBox(null), { box: { x: 0.5, y: 0.45, w: 0, h: 0 }, label: "" });
});

test("detectSubject posts image to Gemini and returns parsed box", async () => {
  let sentUrl;
  const fakeFetch = async (url) => {
    sentUrl = url;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"box":{"x":0.4,"y":0.3,"w":0.2,"h":0.2},"label":"heart"}' }] } }] }) });
  };
  const r = await detectSubject({ apiKey: "K", imageBase64: "AAAA", narration: "n", query: "q", fetchImpl: fakeFetch });
  assert.match(sentUrl, /generativelanguage\.googleapis\.com/);
  assert.deepStrictEqual(r, { box: { x: 0.4, y: 0.3, w: 0.2, h: 0.2 }, label: "heart" });
});
```

- [ ] **Step 2: Run to verify fail** — `node --test pipeline/lib/vision.test.js` → FAIL.

- [ ] **Step 3: Implement**
```js
const CENTER = { box: { x: 0.5, y: 0.45, w: 0, h: 0 }, label: "" };

function clamp01(n) { return Math.min(Math.max(Number(n) || 0, 0), 1); }

function parseBox(obj) {
  if (!obj || !obj.box) return { ...CENTER };
  const b = obj.box;
  return {
    box: { x: clamp01(b.x), y: clamp01(b.y), w: clamp01(b.w), h: clamp01(b.h) },
    label: typeof obj.label === "string" ? obj.label : "",
  };
}

function extractJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in vision output");
  return JSON.parse(text.slice(start, end + 1));
}

async function detectSubject({ apiKey, imageBase64, narration, query, fetchImpl = fetch, model = "gemini-2.0-flash" }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = `Narration: "${narration}". Find the main subject described as "${query}" in this image. Respond ONLY JSON: {"box":{"x":CENTER_X,"y":CENTER_Y,"w":WIDTH,"h":HEIGHT},"label":"2-3 words"} with normalized 0-1 coordinates (x,y = center). If unclear use {"box":{"x":0.5,"y":0.45,"w":0,"h":0},"label":""}.`;
  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }] }],
    generationConfig: { temperature: 0 },
  };
  const r = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) return { ...CENTER };
  const data = await r.json();
  try {
    const text = data.candidates[0].content.parts[0].text;
    return parseBox(extractJSON(text));
  } catch (_) {
    return { ...CENTER };
  }
}
module.exports = { parseBox, detectSubject };
```

- [ ] **Step 4: Verify pass** — `node --test pipeline/lib/vision.test.js` → PASS (2).

- [ ] **Step 5: Commit**
```bash
git add pipeline/lib/vision.js pipeline/lib/vision.test.js
git commit -m "feat: Gemini vision subject detection"
```

---

### Task 10: frame.js — extract representative frame

**Files:**
- Create: `pipeline/lib/frame.js`

- [ ] **Step 1: Implement** (thin ffmpeg wrapper; side-effecting, no unit test):
```js
const { run } = require("./sh");

// Extract a single representative JPEG from a media file (video: mid-point; image: re-encode).
async function extractFrame(mediaPath, outJpg, atSec = 1) {
  await run("ffmpeg", ["-y", "-ss", String(atSec), "-i", mediaPath, "-frames:v", "1", "-vf", "scale=512:-1", outJpg]);
  return outJpg;
}
module.exports = { extractFrame };
```

- [ ] **Step 2: Smoke-check module loads + commit**

Run: `node -e "require('./pipeline/lib/frame.js'); console.log('OK')"` → `OK`.
```bash
git add pipeline/lib/frame.js
git commit -m "feat: ffmpeg representative-frame extractor"
```

---

### Task 11: 05c-annotate stage

**Files:**
- Create: `pipeline/05c-annotate.js`
- Test: `pipeline/05c-annotate.test.js`

- [ ] **Step 1: Write the failing test** (inject deps; no ffmpeg/vision actually run):
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { annotateScenes } = require("./05c-annotate");

test("annotateScenes only annotates flagged scenes and seeds type", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ann-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.mkdirSync(path.join(pubRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(pubRoot, "r1", "scene_01.mp4"), "x");
  fs.writeFileSync(path.join(runRoot, "r1", "scenes.json"), JSON.stringify({
    scenes: [
      { id: 1, narration: "n1", visual_query: "heart", annotate: true },
      { id: 2, narration: "n2", visual_query: "gills", annotate: false },
    ],
  }));
  fs.writeFileSync(path.join(runRoot, "r1", "media.json"), JSON.stringify([
    { sceneId: 1, type: "video", file: "scene_01.mp4" },
    { sceneId: 2, type: "image", file: "scene_02.jpg" },
  ]));
  const deps = {
    extractFrame: async (_m, out) => { fs.writeFileSync(out, "img"); return out; },
    detect: async () => ({ box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "heart" }),
  };
  const anns = await annotateScenes({ runId: "r1", runRoot, pubRoot, seed: "r1", deps });
  assert.strictEqual(anns.length, 1);
  assert.strictEqual(anns[0].sceneId, 1);
  assert.ok(["arrow", "circle"].includes(anns[0].type));
  assert.deepStrictEqual(anns[0].box, { x: 0.5, y: 0.4, w: 0.2, h: 0.2 });
  const written = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "annotations.json"), "utf8"));
  assert.strictEqual(written.length, 1);
});
```

- [ ] **Step 2: Run to verify fail** — `node --test pipeline/05c-annotate.test.js` → FAIL.

- [ ] **Step 3: Implement**
```js
const fs = require("node:fs");
const path = require("node:path");
const { readJSON, writeJSON, runPath } = require("./lib/fsx");
const { pickFrom } = require("./lib/seed");

// deps: { extractFrame(mediaPath, outJpg)->Promise, detect({imageBase64,narration,query})->Promise<{box,label}> }
async function annotateScenes({ runId, runRoot, pubRoot, seed, deps }) {
  const doc = readJSON(runPath(runRoot, runId, "scenes.json"));
  const media = readJSON(runPath(runRoot, runId, "media.json"));
  const byId = new Map(media.map((m) => [m.sceneId, m]));
  const workDir = runPath(runRoot, runId, "_frames");
  fs.mkdirSync(workDir, { recursive: true });

  const annotations = [];
  for (const s of doc.scenes) {
    if (!s.annotate) continue;
    const m = byId.get(s.id);
    if (!m) continue;
    try {
      const mediaPath = path.join(pubRoot, runId, m.file);
      const jpg = path.join(workDir, `scene_${s.id}.jpg`);
      await deps.extractFrame(mediaPath, jpg);
      const imageBase64 = fs.readFileSync(jpg).toString("base64");
      const { box, label } = await deps.detect({ imageBase64, narration: s.narration, query: s.visual_query });
      const type = pickFrom(`${seed}:ann:${s.id}`, ["arrow", "circle"]);
      annotations.push({ sceneId: s.id, box, label, type });
    } catch (_) { /* skip this scene's annotation */ }
  }
  writeJSON(runPath(runRoot, runId, "annotations.json"), annotations);
  return annotations;
}
module.exports = { annotateScenes };

if (require.main === module) {
  const { extractFrame } = require("./lib/frame");
  const { detectSubject } = require("./lib/vision");
  const deps = {
    extractFrame,
    detect: ({ imageBase64, narration, query }) =>
      detectSubject({ apiKey: process.env.GEMINI_API_KEY, imageBase64, narration, query }),
  };
  annotateScenes({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", pubRoot: "remotion/public", seed: process.env.RUN_ID, deps })
    .then((a) => console.log("annotations:", a.length));
}
```

- [ ] **Step 4: Verify pass + full suite** — `node --test pipeline/05c-annotate.test.js` → PASS; `node --test "pipeline/**/*.test.js"` → all PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/05c-annotate.js pipeline/05c-annotate.test.js
git commit -m "feat: stage 05c AI-vision annotation"
```

---

### Task 12: config + .gitignore (sfx) + run.js wiring

**Files:**
- Modify: `pipeline/config.js`
- Modify: `pipeline/config.test.js`
- Modify: `.gitignore`
- Modify: `pipeline/run.js`

- [ ] **Step 1: Add config test** (append to `pipeline/config.test.js`):
```js
test("config has sfx dir + vision model", () => {
  assert.strictEqual(cfg.sfx.dir, "remotion/public/sfx");
  assert.ok(typeof cfg.visionModel === "string" && cfg.visionModel.length > 0);
});
```

- [ ] **Step 2: Run to verify fail** — `node --test pipeline/config.test.js` → FAIL.

- [ ] **Step 3: Implement** — in `pipeline/config.js`, add inside the exported object (after `music`):
```js
  sfx: { dir: "remotion/public/sfx" },
  visionModel: "gemini-2.0-flash",
```

In `.gitignore`, add after the existing `!remotion/public/music/` lines:
```
!remotion/public/sfx/
!remotion/public/sfx/*.mp3
```

In `pipeline/run.js`, after the `fetchSceneMedia(...)` call and BEFORE the `render(...)` call, insert:
```js
  // Stage 05c: AI-vision annotations (best-effort)
  const { annotateScenes } = require("./05c-annotate");
  const { extractFrame } = require("./lib/frame");
  const { detectSubject } = require("./lib/vision");
  try {
    await annotateScenes({
      runId, runRoot, pubRoot: "remotion/public", seed: runId,
      deps: {
        extractFrame,
        detect: ({ imageBase64, narration, query }) =>
          detectSubject({ apiKey: process.env.GEMINI_API_KEY, imageBase64, narration, query, model: cfg.visionModel }),
      },
    });
  } catch (e) { console.log("annotation skipped:", e.message); }
```

- [ ] **Step 4: Verify** — `node --test pipeline/config.test.js` → PASS; `node -e "require('./pipeline/run.js'); console.log('OK')"` → OK; `git check-ignore remotion/public/sfx/x.mp3 || echo NOT_IGNORED` → NOT_IGNORED.

- [ ] **Step 5: Commit**
```bash
git add pipeline/config.js pipeline/config.test.js .gitignore pipeline/run.js
git commit -m "feat: sfx config + gitignore + run.js calls stage 05c"
```

---

### Task 13: 06-render — load annotations + pick sfx

**Files:**
- Modify: `pipeline/06-render.js`
- Modify: `pipeline/06-render.test.js`

- [ ] **Step 1: Update the test** — in `pipeline/06-render.test.js`, add to `seedRun` (after captions.json write):
```js
  fs.writeFileSync(path.join(dir, "annotations.json"), JSON.stringify([{ sceneId: 1, box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "x", type: "circle" }]));
```
Add to `baseArgs` object: `sfxDir,` parameter — change the signature to `(runRoot, pubRoot, musicDir, sfxDir)` and add `sfxDir` to the returned object. Update both existing calls to pass a non-existent sfx dir: `path.join(runRoot, "no-sfx")`.
Then in the music test add:
```js
  assert.deepStrictEqual(props.scenes[0].annotation, { box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "x", type: "circle" });
```

- [ ] **Step 2: Run to verify fail** — `node --test pipeline/06-render.test.js` → FAIL (annotation undefined / signature).

- [ ] **Step 3: Implement** — in `pipeline/06-render.js`:

Add near the top (after existing requires): nothing new needed beyond `readJSON` (already imported).

In `prepareRender`, change the signature to add `sfxDir` and load annotations + pick sfx. Replace the function body's music block region so the full function reads:
```js
function prepareRender({ runId, runRoot, pubRoot, theme, fps, seed, accentPalette, transitions, musicDir, musicVolume, sfxDir }) {
  const scenesDoc = readJSON(runPath(runRoot, runId, "scenes.json"));
  const media = readJSON(runPath(runRoot, runId, "media.json"));
  const captions = readJSON(runPath(runRoot, runId, "captions.json"));
  const annPath = runPath(runRoot, runId, "annotations.json");
  const annotations = fs.existsSync(annPath) ? readJSON(annPath) : [];

  const destBase = path.join(pubRoot, runId);
  fs.mkdirSync(destBase, { recursive: true });
  fs.copyFileSync(runPath(runRoot, runId, "audio", "voiceover.mp3"), path.join(destBase, "voiceover.mp3"));

  const musicSrc = pickAsset(musicDir, seed, destBase, "music.mp3", runId);
  if (musicSrc) appendMusicCredit(runRoot, runId);
  const sfxSrc = pickAsset(sfxDir, `${seed}:sfx`, destBase, "sfx.mp3", runId);

  return buildInputProps({ runId, scenesDoc, media, captions, theme, fps, seed, accentPalette, transitions, musicSrc, musicVolume, annotations, sfxSrc });
}
```
Add this helper above `prepareRender` (replacing the inline music-copy logic; reuses `pickMusic`):
```js
function pickAsset(dir, seed, destBase, destName, runId) {
  try {
    if (dir && fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".mp3"));
      const pick = pickMusic(files, seed);
      if (pick) {
        fs.copyFileSync(path.join(dir, pick), path.join(destBase, destName));
        return `${runId}/${destName}`;
      }
    }
  } catch (_) { /* best-effort */ }
  return null;
}
```
In `render()`, pass `sfxDir: cfg.sfx.dir` alongside the existing args.

- [ ] **Step 4: Verify pass + full suite** — `node --test pipeline/06-render.test.js` → PASS; `node --test "pipeline/**/*.test.js"` → all PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/06-render.js pipeline/06-render.test.js
git commit -m "feat: stage 06 loads annotations + picks sfx track"
```

---

### Task 14: Short — render annotations + SFX

**Files:**
- Modify: `remotion/src/Short.tsx`

- [ ] **Step 1: Implement** — in `remotion/src/Short.tsx`:

Add import:
```tsx
import { Annotation } from "./components/Annotation";
```
Destructure `sfxSrc` from props. Inside the `scenes.map(...)` Sequence (after `EmojiPop`), add:
```tsx
          {scene.annotation ? <Annotation annotation={scene.annotation} /> : null}
          {scene.annotation && sfxSrc ? <Audio src={staticFile(sfxSrc)} /> : null}
```
The `<Audio>` inside the scene's `<Sequence>` plays the SFX from the scene start (the annotation draws at frame ~4, close enough). Keep everything else unchanged.

- [ ] **Step 2: Structural check + full suite**

Run: `node -e "const s=require('node:fs').readFileSync('remotion/src/Short.tsx','utf8'); ['Annotation','sfxSrc','scene.annotation'].forEach(k=>{if(!s.includes(k))throw new Error(k)}); console.log('OK')"`
Run: `node --test "pipeline/**/*.test.js"` → all PASS.

- [ ] **Step 3: Commit**
```bash
git add remotion/src/Short.tsx
git commit -m "feat: Short renders annotations + plays SFX"
```

---

### Task 15: SFX assets folder + docs

**Files:**
- Create: `remotion/public/sfx/README.md`

- [ ] **Step 1: Create**
```markdown
# Sound effects

Drop short royalty-free `.mp3` SFX here (whoosh / scribble / pop). One is chosen
per video (seeded) and played when an annotation draws in. Empty folder = silent
annotations. `.mp3` files here ARE committed (see `.gitignore`).
```

- [ ] **Step 2: Commit**
```bash
git add remotion/public/sfx/README.md
git commit -m "docs: sfx folder"
```

---

### Task 16: full suite + verification

- [ ] **Step 1: Run the whole pipeline suite**

Run: `node --test "pipeline/**/*.test.js"` → ALL pass (providers, stock, seed, config, timeline, vision, 01, 02, 03, 05, 05c, 06, run).

- [ ] **Step 2: Verify anim math** — mirror new helpers in `~/anim_check.cjs` → `MATH_OK`, then delete.

- [ ] **Step 3: Confirm clean tree** — `git status` clean.

---

## Self-Review

**Spec coverage:** §2 content hooks → Tasks 1,5,6. §3 vision stage → Tasks 9,10,11,12. §4.1 cards → Tasks 5,6. §4.2 drawn annotation → Tasks 7,8,14. §4.3 emoji/captions/scene → Tasks 4,5,6. §4.4 SFX → Tasks 12,13,14,15. §5 inputProps → Tasks 2,3. §6 anim helpers → Task 7. All covered.

**Placeholder scan:** none — concrete code/commands throughout.

**Type consistency:** `annotation` shape `{box:{x,y,w,h},label,type}` consistent across stage 05c (Task 11), buildInputProps (Task 2), schema (Task 3), Annotation component (Task 8), boxToScreen (Task 7). `sfxSrc` flow: config (12) → render prepareRender `pickAsset` (13) → buildInputProps (2) → schema (3) → Short `<Audio>` (14). Hook fields (`hookQuestion/waitTeaser/payoff/cta`) flow: stage 02 (1) → buildInputProps reads `scenesDoc.hook_question` etc (2) → schema (3) → Short (6). `pickAsset` reuses `pickMusic` (Task 13 references the existing import). `cfg.visionModel`/`cfg.sfx.dir` defined in Task 12 and used in run.js (12) + 06-render (13). Consistent.
```
