# remo Money & Finance Psychology Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `money` mode — money/finance psychology Shorts on the Fun Honey channel — that reuses the existing explainer engine (topic→script→TTS→media→render→upload) but with a money-focused script, finance-specific Remotion visuals (animated number counter, rising mini-chart, decorative ticker, green/gold theme), and the Fun Honey channel token.

**Architecture:** A third `mode` value routes `run.js` to money content stages (`01m-topic`, `02m-script` emitting per-scene `stat`/`chart`) and a new `Money` Remotion composition that reuses Short's components plus `NumberCounter`/`MiniChart`/`TickerStrip`. Pure logic (stat parsing, counter easing, chart path, money props) is `node:test`-unit-tested; render verified in CI. Uploads route to Fun Honey via the existing `YT_COMMENTS_REFRESH_TOKEN`. The `facts` and dormant `comments` modes stay untouched.

**Tech Stack:** Node 20 CommonJS + `node:test`, Remotion 4.x (`@remotion/media`), Zod, ffmpeg, edge-tts, OpenRouter. No new npm dependency. No new channel auth (Fun Honey token already set).

---

## Data contracts (locked)

`scenes.json` (money, after `02m-script`) — facts scene fields PLUS:
```json
{ "id": 1, "narration": "...", "visual_query": "stock market chart", "visual_query_alt": "cash money",
  "on_screen_text": "COMPOUND INTEREST", "emoji": "💰", "annotate": false,
  "stat": { "value": "$1,000,000", "label": "by age 65" } | null,
  "chart": [10, 25, 18, 60, 100] | null,
  "duration_sec": 0, "audio_start_ms": 0, "audio_end_ms": 0 }
```
Top-level also has `hook_question`, `wait_teaser`, `payoff`, `cta` (same as facts).

Money `inputProps` (built by `buildMoneyProps`) = the `buildInputProps` output PLUS each scene gains `stat` (`{value,label}|null`) and `chart` (`number[]|null`).

---

# PHASE 1 — Content + props

### Task 1: config — money mode + niche

**Files:** Modify `pipeline/config.js`, `pipeline/config.test.js`

- [ ] **Step 1: Append test**
```js
test("config has money niche (accent + channel)", () => {
  assert.ok(Array.isArray(cfg.niches.money.accentPalette) && cfg.niches.money.accentPalette.length >= 2);
  assert.strictEqual(cfg.niches.money.channelName, "@FunHoney");
});
```

- [ ] **Step 2: Run** `node --test pipeline/config.test.js` → FAIL.

- [ ] **Step 3: Implement** — add to the `pipeline/config.js` exported object (after `commentsChannelName`):
```js
  niches: {
    money: {
      accentPalette: ["#16C784", "#F0B90B", "#2EBD85", "#FFD700"],
      channelName: "@FunHoney",
    },
  },
```

- [ ] **Step 4: Run** → PASS. Then `node --test "pipeline/**/*.test.js"` → all PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/config.js pipeline/config.test.js
git commit -m "feat: config money niche (accent + channel)"
```

---

### Task 2: 01m-topic — money topic selection

**Files:** Create `pipeline/01m-topic.js`, `pipeline/01m-topic.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { pickMoneyTopic } = require("./01m-topic");

test("pickMoneyTopic asks model avoiding recent topics and writes topic.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mtopic-"));
  const history = { entries: [{ slug: "compound-interest", topic: "Compound interest", status: "published", mode: "money" }] };
  let seen;
  const fakeChat = async ({ messages }) => { seen = messages; return { topic: "Why you overspend", angle: "money psychology", why_interesting: "scarcity mindset", slug: "why-you-overspend" }; };
  const result = await pickMoneyTopic({ runId: "r1", runRoot, history, chat: fakeChat });
  assert.match(JSON.stringify(seen), /Compound interest/);
  assert.match(JSON.stringify(seen), /money|finance/i);
  assert.strictEqual(result.slug, "why-you-overspend");
  const w = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "topic.json"), "utf8"));
  assert.strictEqual(w.topic, "Why you overspend");
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `pipeline/01m-topic.js`
```js
const { writeJSON, runPath } = require("./lib/fsx");
const { recentTopics } = require("./lib/history");

const SYSTEM = "You pick one engaging MONEY & FINANCE PSYCHOLOGY topic for a 45-second English YouTube Short. Mix angles across videos: money psychology (why we overspend, scarcity mindset), rich-vs-poor mindset, or one actionable money rule (e.g. compound interest, 50/30/20). It must be visualizable with stock footage + simple charts. Educational/entertainment, NOT personalized financial advice. Respond ONLY JSON: {topic, angle, why_interesting, slug}. slug is kebab-case.";

async function pickMoneyTopic({ runId, runRoot, history, chat }) {
  const avoid = recentTopics(history);
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Avoid these already-used money topics: ${JSON.stringify(avoid)}. Give one fresh, distinct money/finance topic.` },
  ];
  const topic = await chat({ messages });
  writeJSON(runPath(runRoot, runId, "topic.json"), topic);
  return topic;
}
module.exports = { pickMoneyTopic };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const { readJSON } = require("./lib/fsx");
  const fs = require("node:fs");
  const runId = process.env.RUN_ID; const runRoot = process.env.RUN_ROOT || "run";
  const history = fs.existsSync("state/history.json") ? readJSON("state/history.json") : { entries: [] };
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  pickMoneyTopic({ runId, runRoot, history, chat }).then((t) => console.log("money topic:", t.topic));
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/01m-topic.js pipeline/01m-topic.test.js
git commit -m "feat: stage 01m money topic selection"
```

---

### Task 3: 02m-script — money script with stat/chart + disclaimer

**Files:** Create `pipeline/02m-script.js`, `pipeline/02m-script.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { writeMoneyScript } = require("./02m-script");

test("writeMoneyScript persists scenes (stat/chart) + meta with disclaimer", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mscript-"));
  const topic = { topic: "Compound interest", angle: "rule", why_interesting: "growth", slug: "compound-interest" };
  const fakeChat = async () => ({
    hook: "Money doubles.", hook_question: "Guess how fast money grows?", wait_teaser: "Wait for the number.", payoff: "It compounds!",
    cta: "Follow for money tips.",
    scenes: [
      { id: 1, narration: "Compound interest grows your money.", visual_query: "stock chart rising", visual_query_alt: "cash", on_screen_text: "COMPOUND", emoji: "💰", annotate: false, stat: { value: "$1,000,000", label: "by 65" }, chart: [10, 30, 55, 100] },
      { id: 2, narration: "Start early.", visual_query: "piggy bank", visual_query_alt: "savings", on_screen_text: null, emoji: "🏦", annotate: false, stat: null, chart: null },
    ],
    title: "How Money Doubles #shorts", description: "A money rule.", tags: ["money", "finance", "shorts"],
  });
  const r = await writeMoneyScript({ runId: "r1", runRoot, topic, chat: fakeChat });
  const scenes = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "scenes.json"), "utf8"));
  const meta = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "meta.json"), "utf8"));
  assert.deepStrictEqual(scenes.scenes[0].stat, { value: "$1,000,000", label: "by 65" });
  assert.deepStrictEqual(scenes.scenes[0].chart, [10, 30, 55, 100]);
  assert.strictEqual(scenes.scenes[1].stat, null);
  assert.match(meta.description, /not financial advice/i);
  assert.ok(meta.tags.includes("shorts"));
  assert.strictEqual(r.scenes.scenes.length, 2);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `pipeline/02m-script.js`
```js
const { writeJSON, runPath } = require("./lib/fsx");

const SYSTEM = `You are a YouTube Shorts scriptwriter for a MONEY & FINANCE PSYCHOLOGY channel. Write a ~50 second English voiceover, 5-6 scenes (100-115 words total, under 60s). Engagement structure:
- Scene 1 narration OPENS with a curiosity/guess question.
- A "wait for it" bridge in the middle.
- The LAST scene narration delivers the payoff + a call to action (comment + follow).
Educational/entertainment, NOT personalized financial advice.
Respond ONLY JSON: {hook, hook_question, wait_teaser, payoff, cta, scenes:[{id, narration, visual_query, visual_query_alt, on_screen_text, emoji, annotate, stat, chart}], title, description, tags}.
- stat: a key number to animate as {value, label} where value is a short money/number string like "$1,000,000" or "340%" and label is 2-4 words; or null. Put a stat on 1-2 scenes.
- chart: a rising trend as an array of 3-6 increasing numbers (e.g. [10,30,55,100]); or null. Put a chart on the scene that shows growth.
- visual_query: 2-4 English words, money/business/finance footage. visual_query_alt: a different backup.
- on_screen_text: short punchy caption or null. emoji: ONE relevant money emoji or null. annotate: usually false.
- title <= 90 chars ending with " #shorts". tags 10-20 incl "money","finance","investing","shorts".`;

async function writeMoneyScript({ runId, runRoot, topic, chat }) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Topic: ${topic.topic}\nAngle: ${topic.angle}\nWhy interesting: ${topic.why_interesting}` },
  ];
  const out = await chat({ messages });
  const scenes = {
    hook: out.hook, cta: out.cta,
    hook_question: out.hook_question || null,
    wait_teaser: out.wait_teaser || null,
    payoff: out.payoff || null,
    audio_path: "audio/voiceover.mp3", total_duration_sec: 0,
    scenes: out.scenes.map((s) => ({
      id: s.id, narration: s.narration,
      visual_query: s.visual_query, visual_query_alt: s.visual_query_alt || null,
      on_screen_text: s.on_screen_text || null, emoji: s.emoji || null, annotate: !!s.annotate,
      stat: s.stat && s.stat.value ? { value: String(s.stat.value), label: String(s.stat.label || "") } : null,
      chart: Array.isArray(s.chart) && s.chart.length >= 2 ? s.chart.map(Number) : null,
      duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0,
    })),
  };
  const DISCLAIMER = "\n\n⚠️ Educational and entertainment only — not financial advice.";
  const desc = (out.description || "") + DISCLAIMER;
  const meta = { title: out.title, description: desc, tags: out.tags, category_id: 25 };
  writeJSON(runPath(runRoot, runId, "scenes.json"), scenes);
  writeJSON(runPath(runRoot, runId, "meta.json"), meta);
  return { scenes, meta };
}
module.exports = { writeMoneyScript };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const { readJSON, runPath } = require("./lib/fsx");
  const runId = process.env.RUN_ID; const runRoot = process.env.RUN_ROOT || "run";
  const topic = readJSON(runPath(runRoot, runId, "topic.json"));
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  writeMoneyScript({ runId, runRoot, topic, chat }).then((r) => console.log("scenes:", r.scenes.scenes.length));
}
```

- [ ] **Step 4: Run** → PASS. Full suite PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/02m-script.js pipeline/02m-script.test.js
git commit -m "feat: stage 02m money script (stat/chart + disclaimer)"
```

---

### Task 4: buildMoneyProps

**Files:** Modify `pipeline/lib/timeline.js`, `pipeline/lib/timeline.test.js`

- [ ] **Step 1: Append test**
```js
const { buildMoneyProps } = require("./timeline");

test("buildMoneyProps = buildInputProps + per-scene stat/chart", () => {
  const scenesDoc = { scenes: [
    { id: 1, on_screen_text: "A", duration_sec: 2.0, stat: { value: "$1M", label: "x" }, chart: [1, 2, 3] },
    { id: 2, on_screen_text: null, duration_sec: 1.0, stat: null, chart: null },
  ]};
  const media = [{ sceneId: 1, type: "video", file: "scene_01.mp4" }, { sceneId: 2, type: "image", file: "scene_02.jpg" }];
  const props = buildMoneyProps({
    runId: "r1", scenesDoc, media, captions: [],
    theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@f" },
    fps: 30, seed: "r1", accentPalette: ["#16C784", "#F0B90B"], transitions: ["slideLeft", "fade"],
  });
  assert.deepStrictEqual(props.scenes[0].stat, { value: "$1M", label: "x" });
  assert.deepStrictEqual(props.scenes[0].chart, [1, 2, 3]);
  assert.strictEqual(props.scenes[1].stat, null);
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.ok(["#16C784", "#F0B90B"].includes(props.theme.accentColor));
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — append to `pipeline/lib/timeline.js` (before `module.exports`); it reuses `buildInputProps`:
```js
function buildMoneyProps(args) {
  const base = buildInputProps(args);
  const byId = new Map(args.scenesDoc.scenes.map((s) => [s.id, s]));
  base.scenes = base.scenes.map((node) => {
    const s = byId.get(node.id) || {};
    return { ...node, stat: s.stat || null, chart: Array.isArray(s.chart) ? s.chart : null };
  });
  return base;
}
```
Add `buildMoneyProps` to the `module.exports`.

- [ ] **Step 4: Run** → PASS. Full suite PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/lib/timeline.js pipeline/lib/timeline.test.js
git commit -m "feat: buildMoneyProps (scene stat/chart)"
```

---

# PHASE 2 — Finance Remotion

### Task 5: anim — parseStat, countValue, formatCount, chartPath

**Files:** Modify `remotion/src/lib/anim.ts`, `remotion/src/lib/anim.test.ts`

- [ ] **Step 1: Append tests**
```ts
import { parseStat, countValue, formatCount, chartPath } from "./anim";

test("parseStat splits prefix/number/suffix and scales k/m", () => {
  assert.deepStrictEqual(parseStat("$1,000,000"), { prefix: "$", num: 1000000, suffix: "" });
  assert.deepStrictEqual(parseStat("$1.2M"), { prefix: "$", num: 1200000, suffix: "" });
  assert.deepStrictEqual(parseStat("340%"), { prefix: "", num: 340, suffix: "%" });
  assert.deepStrictEqual(parseStat("50k"), { prefix: "", num: 50000, suffix: "" });
});

test("countValue eases 0..target", () => {
  assert.strictEqual(countValue(100, 0), 0);
  assert.strictEqual(countValue(100, 1), 100);
  assert.ok(countValue(100, 0.5) > 50);
});

test("formatCount groups thousands", () => {
  assert.strictEqual(formatCount(1000000), "1,000,000");
  assert.strictEqual(formatCount(340), "340");
});

test("chartPath maps points into an SVG polyline", () => {
  const p = chartPath([0, 10], 100, 50);
  assert.match(p, /^M 0 50 L 100 0$/);
});
```

- [ ] **Step 2: Run** (CI `npm test`, or mirror in `~/anim_check.cjs`) → FAIL.

- [ ] **Step 3: Implement** — append to `remotion/src/lib/anim.ts`:
```ts
export function parseStat(s: string): { prefix: string; num: number; suffix: string } {
  const m = String(s).trim().match(/^([^0-9.]*)([\d.,]+)\s*([kmb]?)\s*(%?)/i);
  if (!m) return { prefix: "", num: 0, suffix: "" };
  const prefix = m[1] || "";
  const num = parseFloat(m[2].replace(/,/g, "")) || 0;
  const unit = (m[3] || "").toLowerCase();
  const scale = unit === "k" ? 1e3 : unit === "m" ? 1e6 : unit === "b" ? 1e9 : 1;
  return { prefix, num: Math.round(num * scale), suffix: m[4] || "" };
}

export function countValue(target: number, p: number): number {
  const t = Math.min(Math.max(p, 0), 1);
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.round(target * eased);
}

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// points -> "M x0 y0 L x1 y1 ..." normalized to width w, height h (y inverted; min->bottom, max->top)
export function chartPath(points: number[], w: number, h: number): string {
  if (!points.length) return "";
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  return points
    .map((v, i) => {
      const x = Math.round(i * step);
      const y = Math.round(h - ((v - min) / span) * h);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}
```

- [ ] **Step 4: Verify** (CI `npm test`; locally `node ~/anim_check.cjs && echo MATH_OK` mirroring the four fns, then delete) → PASS / MATH_OK.

- [ ] **Step 5: Commit**
```bash
git add remotion/src/lib/anim.ts remotion/src/lib/anim.test.ts
git commit -m "feat: finance anim helpers (parseStat/countValue/formatCount/chartPath)"
```

---

### Task 6: schema — moneySchema

**Files:** Modify `remotion/src/schema.ts`

- [ ] **Step 1: Implement** — append to `remotion/src/schema.ts`:
```ts
export const statSchema = z.object({ value: z.string(), label: z.string() });

export const moneySceneSchema = sceneSchema.extend({
  stat: statSchema.nullable(),
  chart: z.array(z.number()).nullable(),
});

export const moneySchema = shortSchema.extend({
  scenes: z.array(moneySceneSchema),
});
export type MoneyProps = z.infer<typeof moneySchema>;
export type MoneyScene = z.infer<typeof moneySceneSchema>;
```

- [ ] **Step 2: Structural check**
Run: `node -e "const s=require('node:fs').readFileSync('remotion/src/schema.ts','utf8'); ['moneySchema','statSchema','moneySceneSchema'].forEach(k=>{if(!s.includes(k))throw new Error(k)});console.log('OK')"`

- [ ] **Step 3: Commit**
```bash
git add remotion/src/schema.ts
git commit -m "feat: money composition schema"
```

---

### Task 7: NumberCounter, MiniChart, TickerStrip

**Files:** Create the three components under `remotion/src/components/`.

- [ ] **Step 1: NumberCounter.tsx**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { parseStat, countValue, formatCount, popScale } from "../lib/anim";

export const NumberCounter: React.FC<{ value: string; label: string; fontFamily: string; accentColor: string }> = ({
  value, label, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { prefix, num, suffix } = parseStat(value);
  const p = Math.min(frame / Math.round(fps * 1.2), 1);
  const shown = countValue(num, p);
  const pop = popScale(Math.min(frame / 8, 1));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${pop})`, textAlign: "center" }}>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 120, color: accentColor, WebkitTextStroke: "5px black", paintOrder: "stroke fill" }}>
          {prefix}{formatCount(shown)}{suffix} 💰
        </div>
        {label ? <div style={{ fontFamily, fontWeight: 800, fontSize: 40, color: "white", marginTop: 8, WebkitTextStroke: "3px black", paintOrder: "stroke fill" }}>{label}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: MiniChart.tsx**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { chartPath, drawProgress, dashOffsetFor } from "../lib/anim";

const W = 600, H = 320;

export const MiniChart: React.FC<{ points: number[]; accentColor: string }> = ({ points, accentColor }) => {
  const frame = useCurrentFrame();
  const p = drawProgress(frame, 6, 18);
  if (p <= 0 || points.length < 2) return null;
  const d = chartPath(points, W, H);
  const len = 1600;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 520 }}>
      <svg width={W} height={H + 30} viewBox={`0 0 ${W} ${H + 30}`}>
        <path d={d} fill="none" stroke={accentColor} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={len} strokeDashoffset={dashOffsetFor(len, p)} style={{ filter: `drop-shadow(0 0 12px ${accentColor})` }} />
        {p > 0.85 ? <text x={W - 40} y={20} fill={accentColor} fontSize={64} fontWeight={800}>↗</text> : null}
      </svg>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: TickerStrip.tsx**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

const SYMBOLS = [
  { t: "AAPL", up: true }, { t: "BTC", up: true }, { t: "TSLA", up: false }, { t: "SPY", up: true },
  { t: "ETH", up: false }, { t: "GOLD", up: true }, { t: "NVDA", up: true }, { t: "OIL", up: false },
];

export const TickerStrip: React.FC<{ fontFamily: string }> = ({ fontFamily }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [0, -1200]);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start" }}>
      <div style={{ marginTop: 40, height: 56, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 48, transform: `translateX(${x}px)`, paddingLeft: 40, whiteSpace: "nowrap" }}>
          {SYMBOLS.concat(SYMBOLS).map((s, i) => (
            <span key={i} style={{ fontFamily, fontWeight: 800, fontSize: 30, color: s.up ? "#16C784" : "#FF5C5C" }}>
              {s.t} {s.up ? "▲" : "▼"}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Structural check + commit**
Run: `node -e "['NumberCounter','MiniChart','TickerStrip'].forEach(n=>require('node:fs').readFileSync('remotion/src/components/'+n+'.tsx','utf8'));console.log('OK')"`
```bash
git add remotion/src/components/NumberCounter.tsx remotion/src/components/MiniChart.tsx remotion/src/components/TickerStrip.tsx
git commit -m "feat: finance components (NumberCounter, MiniChart, TickerStrip)"
```

---

### Task 8: Money.tsx composition + Root registration

**Files:** Create `remotion/src/Money.tsx`; Modify `remotion/src/Root.tsx`

- [ ] **Step 1: Money.tsx**
```tsx
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
```
NOTE: when a scene has a `stat`, the big `NumberCounter` replaces the smaller `OnScreenText` (avoids stacking). `MiniChart` sits lower (paddingBottom) so it doesn't collide with the counter.

- [ ] **Step 2: Root.tsx** — add the third composition. Add imports:
```tsx
import { Money } from "./Money";
import { moneySchema, type MoneyProps } from "./schema";
```
Add a default const near the others:
```tsx
const moneyDefault: MoneyProps = {
  fps: 30, width: 1080, height: 1920, audioSrc: "", musicSrc: null, musicVolume: 0.1, sfxSrc: null,
  hookQuestion: null, waitTeaser: null, payoff: null, cta: null,
  theme: { accentColor: "#16C784", fontFamily: "Anton", channelName: "@FunHoney" }, captions: [], scenes: [],
};
```
Inside the `<>...</>` of `RemotionRoot`, after the `Comments` composition, add:
```tsx
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
```

- [ ] **Step 3: Structural check + commit**
Run: `node -e "const r=require('node:fs').readFileSync('remotion/src/Root.tsx','utf8'); if(!r.includes('id=\"Money\"')||!r.includes('moneySchema'))throw new Error('root'); require('node:fs').readFileSync('remotion/src/Money.tsx','utf8'); console.log('OK')"`
```bash
git add remotion/src/Money.tsx remotion/src/Root.tsx
git commit -m "feat: Money composition + Root registration"
```

---

# PHASE 3 — Render + run + CI

### Task 9: 06-render — money branch

**Files:** Modify `pipeline/06-render.js`, `pipeline/06-render.test.js`

- [ ] **Step 1: Append test**
```js
const { prepareMoneyRender } = require("./06-render");

test("prepareMoneyRender builds money props with stat/chart", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mr-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mpub-"));
  const dir = path.join(runRoot, "r1"); fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.mkdirSync(path.join(pubRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(dir, "audio", "voiceover.mp3"), "AUDIO");
  fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify([]));
  fs.writeFileSync(path.join(dir, "media.json"), JSON.stringify([{ sceneId: 1, type: "video", file: "scene_01.mp4" }]));
  fs.writeFileSync(path.join(dir, "scenes.json"), JSON.stringify({ scenes: [{ id: 1, on_screen_text: "A", duration_sec: 2.0, stat: { value: "$1M", label: "x" }, chart: [1, 2, 3] }], total_duration_sec: 2.0 }));
  const props = prepareMoneyRender({ runId: "r1", runRoot, pubRoot, theme: { accentColor: "#16C784", fontFamily: "Anton", channelName: "@FunHoney" }, fps: 30, seed: "r1", accentPalette: ["#16C784"], transitions: ["fade"], musicDir: path.join(runRoot, "no"), musicVolume: 0.1, sfxDir: path.join(runRoot, "no") });
  assert.deepStrictEqual(props.scenes[0].stat, { value: "$1M", label: "x" });
  assert.deepStrictEqual(props.scenes[0].chart, [1, 2, 3]);
  assert.strictEqual(fs.readFileSync(path.join(pubRoot, "r1", "voiceover.mp3"), "utf8"), "AUDIO");
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — in `pipeline/06-render.js`:
Extend the timeline require to include `buildMoneyProps`: change `const { buildInputProps, buildCommentsProps } = require("./lib/timeline");` to `const { buildInputProps, buildCommentsProps, buildMoneyProps } = require("./lib/timeline");`.
Add after `prepareRender` (reuses `pickAsset`, `appendMusicCredit`, loads annotations like facts):
```js
function prepareMoneyRender({ runId, runRoot, pubRoot, theme, fps, seed, accentPalette, transitions, musicDir, musicVolume, sfxDir }) {
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
  return buildMoneyProps({ runId, scenesDoc, media, captions, theme, fps, seed, accentPalette, transitions, musicSrc, musicVolume, annotations, sfxSrc });
}

async function renderMoney({ runId, runRoot, pubRoot, theme, fps, outFile }) {
  const cfg = require("./config");
  const inputProps = prepareMoneyRender({ runId, runRoot, pubRoot, theme, fps, seed: runId, accentPalette: cfg.niches.money.accentPalette, transitions: cfg.transitions, musicDir: cfg.music.dir, musicVolume: cfg.music.volume, sfxDir: cfg.sfx.dir });
  const { bundle } = require("@remotion/bundler");
  const { renderMedia, selectComposition } = require("@remotion/renderer");
  const serveUrl = await bundle({ entryPoint: path.resolve("remotion/src/index.ts") });
  const composition = await selectComposition({ serveUrl, id: "Money", inputProps });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: outFile, inputProps });
  return outFile;
}
```
Extend `module.exports` to include `prepareMoneyRender, renderMoney`.

- [ ] **Step 4: Run** → PASS. Full suite PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/06-render.js pipeline/06-render.test.js
git commit -m "feat: money render (prepareMoneyRender + renderMoney)"
```

---

### Task 10: run.js — money mode branch

**Files:** Modify `pipeline/run.js`

- [ ] **Step 1: Implement** — in `main()`, add a `money` branch (after the `comments` branch, before the facts flow):
```js
  if (cfg.mode === "money") {
    const { pickMoneyTopic } = require("./01m-topic");
    const { writeMoneyScript } = require("./02m-script");
    const { renderMoney } = require("./06-render");
    const { findMediaCandidates } = require("./lib/stock");
    let topic;
    for (let attempt = 0; attempt < 3; attempt++) {
      topic = await pickMoneyTopic({ runId, runRoot, history, chat });
      if (!isDuplicate(history, topic.slug)) break;
    }
    await writeMoneyScript({ runId, runRoot, topic, chat });
    const voDeps = { synth: sh.synth, probeDuration: sh.probeDuration, concat: sh.concat };
    await makeVoiceover({ runId, runRoot, voice: cfg.voice, rate: cfg.ttsRate, deps: voDeps });
    const provFns = {
      pexelsVideo: (q) => providers.pexelsVideoCandidates(q, { apiKey: process.env.PEXELS_API_KEY }),
      pixabayVideo: (q) => providers.pixabayVideoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
      pixabayPhoto: (q) => providers.pixabayPhotoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
      unsplash: (q) => providers.unsplashCandidates(q, { apiKey: process.env.UNSPLASH_API_KEY }),
    };
    const find = (q) => findMediaCandidates(q, cfg.mediaOrder, provFns);
    await fetchSceneMedia({ runId, runRoot, pubRoot: "remotion/public", find, download });
    const outFile = `out/${runId}.mp4`;
    await renderMoney({ runId, runRoot, pubRoot: "remotion/public", theme: { ...cfg.theme, accentColor: cfg.niches.money.accentPalette[0], channelName: cfg.niches.money.channelName }, fps: cfg.render.fps, outFile });
    const nextHistory = addEntry(history, { mode: "money", slug: topic.slug, topic: topic.topic, status: "pending", runId });
    writeJSON(historyPath, nextHistory);
    console.log(JSON.stringify({ runId, mode: "money", topic: topic.topic, outFile }));
    return;
  }
```
Ensure `isDuplicate`, `makeVoiceover`, `fetchSceneMedia`, `providers`, `download`, `sh`, `addEntry`, `writeJSON`, `historyPath`, `history`, `chat` are in scope (they already are — used by the facts flow). The accentColor passed is `cfg.niches.money.accentPalette[0]`, but `buildMoneyProps` re-seeds accent from `accentPalette` anyway (renderMoney passes the money palette), so the per-video accent still varies; `theme.channelName` carries the Fun Honey handle for the EndCard.

- [ ] **Step 2: Verify** — `node -e "require('./pipeline/run.js'); console.log('OK')"` → OK. Full suite PASS.

- [ ] **Step 3: Commit**
```bash
git add pipeline/run.js
git commit -m "feat: run.js money mode branch"
```

---

### Task 11: CI token routing + verify

**Files:** Modify `.github/workflows/produce.yml`, `.github/workflows/publish.yml`

- [ ] **Step 1: produce.yml** — the upload step currently selects the token by `if mode == comments`. Change it so ANY non-facts mode uses Fun Honey. Replace the `if` line in the upload `run:` with:
```bash
          if [ "${{ inputs.mode }}" = "facts" ]; then RT=YOUTUBE_REFRESH_TOKEN; else RT=YT_COMMENTS_REFRESH_TOKEN; fi
```
(The `mode` input's allowed values are now facts | comments | money — update its `description` to `"facts, comments, or money"`.)

- [ ] **Step 2: publish.yml** — make the channel selector treat any non-facts channel as Fun Honey. Replace the `if` line in its `run:` with:
```bash
          if [ "${{ inputs.channel }}" = "facts" ]; then RT=YOUTUBE_REFRESH_TOKEN; else RT=YT_COMMENTS_REFRESH_TOKEN; fi
```
and update the `channel` input `description` to `"facts (DustMust) or funhoney (comments/money)"`.

- [ ] **Step 3: Validate YAML**
Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/produce.yml')); yaml.safe_load(open('.github/workflows/publish.yml')); print('YAML_OK')"`

- [ ] **Step 4: Full suite + run load**
Run: `node --test "pipeline/**/*.test.js"` → all PASS.
Run: `node -e "require('./pipeline/run.js'); console.log('OK')"` → OK.

- [ ] **Step 5: Commit**
```bash
git add .github/workflows/produce.yml .github/workflows/publish.yml
git commit -m "ci: route non-facts modes (comments/money) to Fun Honey token"
```

---

## Self-Review

**Spec coverage:** §2 mode switch → Tasks 1,10. §3.1 topic → Task 2. §3.2 script stat/chart+disclaimer → Task 3. §3.3 shared stages → reused (Task 10 wires makeVoiceover/fetchSceneMedia). §4.1 reused components → Task 8. §4.2 finance components → Task 7. §4.3 props → Tasks 4,9. §4.4 anim helpers → Task 5. §4.5 theme → Tasks 1,10. §5 channel/upload → Task 11. §6 CI → Task 11. All covered.

**Placeholder scan:** none — concrete code/commands throughout.

**Type consistency:** scene `stat` (`{value,label}|null`) + `chart` (`number[]|null`) consistent across 02m-script (Task 3), buildMoneyProps (Task 4), moneySceneSchema (Task 6), Money.tsx (Task 8), prepareMoneyRender (Task 9). `buildMoneyProps` wraps `buildInputProps` (Task 4) so all base props (transition/annotation/sfx/hooks) flow through. `parseStat/countValue/formatCount/chartPath` (Task 5) used by NumberCounter/MiniChart (Task 7). `cfg.niches.money.accentPalette/channelName` (Task 1) used in renderMoney (Task 9) + run.js (Task 10). `prepareMoneyRender`/`renderMoney` (Task 9) consume scenes.json from 02m + media.json from stage 05. Token routing (Task 11): facts→YOUTUBE, comments|money→YT_COMMENTS — matches run.js channel (Fun Honey) for money. Consistent.
