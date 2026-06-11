# remo Shorts Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end, GitHub-Actions-driven pipeline that turns a single trigger into an English "fun facts" YouTube Short: pick topic → write script → TTS → captions → stock media → Remotion render → private YouTube upload, with mobile approve/reject.

**Architecture:** A Node.js/TypeScript orchestrator (`pipeline/`) runs ordered stages, each reading/writing JSON in `run/<id>/`. Pure logic (dedup, timeline, stock fallback, caption lookup) lives in small tested helper modules; side-effecting parts (TTS, Whisper, ffmpeg, YouTube) are thin Python/CLI wrappers. Remotion (`remotion/`) renders the final vertical video from the accumulated JSON. Two GitHub Actions workflows run production and publish.

**Tech Stack:** Node 20 + TypeScript, `node:test` (zero-dep test runner), Remotion 4.x, `@remotion/captions`, `@remotion/google-fonts`, Zod, Python 3.11 (`edge-tts`, `openai-whisper`, `google-api-python-client`), ffmpeg, OpenRouter, Pexels/Pixabay/Unsplash, GitHub Actions.

---

## Data Contracts (locked — used across all tasks)

`run/<id>/topic.json`
```json
{ "topic": "Why octopuses have three hearts",
  "angle": "biology fun fact",
  "why_interesting": "Two pump blood to the gills, one to the body.",
  "slug": "octopus-three-hearts" }
```

`run/<id>/scenes.json` (after stage 02; stage 03 adds timing fields)
```json
{ "hook": "Octopuses have THREE hearts.",
  "cta": "Follow for more.",
  "audio_path": "audio/voiceover.mp3",
  "total_duration_sec": 0,
  "scenes": [
    { "id": 1, "narration": "Octopuses have three hearts.",
      "visual_query": "octopus ocean", "on_screen_text": "3 HEARTS",
      "duration_sec": 0, "audio_start_ms": 0, "audio_end_ms": 0 }
  ] }
```

`run/<id>/meta.json`
```json
{ "title": "Why Octopuses Have 3 Hearts #shorts",
  "description": "...",
  "tags": ["octopus", "fun facts", "science", "shorts"] }
```

`run/<id>/captions.json` — `@remotion/captions` `Caption[]`
```json
[ { "text": "Octopuses", "startMs": 0, "endMs": 420, "timestampMs": 210, "confidence": 1 } ]
```

`run/<id>/media.json`
```json
[ { "sceneId": 1, "type": "video", "file": "scene_01.mp4" } ]
```

Remotion `inputProps` (built by stage 06):
```json
{ "fps": 30, "width": 1080, "height": 1920,
  "audioSrc": "<run-id>/voiceover.mp3",
  "theme": { "accentColor": "#FFD400", "fontFamily": "Anton", "channelName": "@channel" },
  "captions": [ /* Caption[] */ ],
  "scenes": [ { "id": 1, "onScreenText": "3 HEARTS",
                "startFrame": 0, "durationFrames": 120,
                "media": { "type": "video", "src": "<run-id>/scene_01.mp4" } } ] }
```

All `src`/`audioSrc` values are paths relative to `remotion/public/`, resolved with `staticFile()`.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` (root) | Pipeline deps + scripts (`test`, `lint`) |
| `pipeline/config.js` | Defaults: voice, fps, dims, theme, stock order, model |
| `pipeline/lib/fsx.js` | run-dir path helpers, readJSON/writeJSON |
| `pipeline/lib/history.js` | history.json load/save + dedup of topics |
| `pipeline/lib/openrouter.js` | OpenRouter chat call + JSON extraction |
| `pipeline/lib/stock.js` | Pexels→Pixabay→Unsplash portrait search w/ fallback |
| `pipeline/lib/timeline.js` | scene timings + buildInputProps |
| `pipeline/01-topic.js` … `06-render.js` | stage entrypoints |
| `pipeline/run.js` | runs 01→06 in order |
| `scripts/tts.py` | edge-tts: text→mp3 |
| `scripts/transcribe.py` | whisper: mp3→Caption[] json |
| `scripts/upload_youtube.py` | upload (private) / set-privacy / delete |
| `remotion/src/schema.ts` | Zod inputProps schema + types |
| `remotion/src/lib/anim.ts` | pure anim helpers (kenBurns, fade, activeCaption) |
| `remotion/src/components/*.tsx` | Scene, Captions, OnScreenText, ProgressBar |
| `remotion/src/Short.tsx`, `Root.tsx` | composition |
| `.github/workflows/produce.yml`, `publish.yml` | CI |

---

## Phase 0 — Scaffolding

### Task 1: Root Node project + test runner

**Files:**
- Create: `package.json`
- Create: `pipeline/lib/fsx.js`
- Test: `pipeline/lib/fsx.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/lib/fsx.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { writeJSON, readJSON, runPath } = require("./fsx");

test("writeJSON then readJSON round-trips", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fsx-"));
  const f = path.join(dir, "a.json");
  writeJSON(f, { x: 1 });
  assert.deepStrictEqual(readJSON(f), { x: 1 });
});

test("runPath joins run dir + id + parts", () => {
  assert.strictEqual(runPath("/r", "id1", "topic.json"), path.join("/r", "id1", "topic.json"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/lib/fsx.test.js`
Expected: FAIL — `Cannot find module './fsx'`

- [ ] **Step 3: Create package.json and implementation**

`package.json`
```json
{
  "name": "remo",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test pipeline/**/*.test.js",
    "lint": "tsc -p remotion --noEmit"
  },
  "dependencies": {
    "@remotion/bundler": "^4.0.0",
    "@remotion/renderer": "^4.0.0"
  }
}
```

> Note: `pipeline/06-render.js` runs from the repo root, so the renderer/bundler are root dependencies here. The `remotion/` package keeps its own deps (react, remotion, components) which the bundler resolves relative to `remotion/src/index.ts`.

`pipeline/lib/fsx.js`
```js
const fs = require("node:fs");
const path = require("node:path");

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function runPath(runRoot, id, ...parts) {
  return path.join(runRoot, id, ...parts);
}
module.exports = { writeJSON, readJSON, runPath };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/lib/fsx.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add package.json pipeline/lib/fsx.js pipeline/lib/fsx.test.js
git commit -m "chore: scaffold node project + fsx helpers"
```

---

### Task 2: .gitignore + config defaults

**Files:**
- Create: `.gitignore`
- Create: `pipeline/config.js`
- Test: `pipeline/config.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/config.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const cfg = require("./config");

test("config has render + stock + voice defaults", () => {
  assert.strictEqual(cfg.render.width, 1080);
  assert.strictEqual(cfg.render.height, 1920);
  assert.strictEqual(cfg.render.fps, 30);
  assert.deepStrictEqual(cfg.stockOrder, ["pexels", "pixabay", "unsplash"]);
  assert.ok(cfg.voice.startsWith("en-US-"));
  assert.ok(cfg.theme.accentColor.startsWith("#"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/config.test.js`
Expected: FAIL — cannot find `./config`

- [ ] **Step 3: Implement**

`pipeline/config.js`
```js
module.exports = {
  render: { width: 1080, height: 1920, fps: 30 },
  voice: "en-US-ChristopherNeural",
  ttsRate: "+8%",
  stockOrder: ["pexels", "pixabay", "unsplash"],
  model: "deepseek/deepseek-chat",
  theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@channel" },
};
```

`.gitignore`
```
node_modules/
run/
out/
remotion/public/*/
!remotion/public/.gitkeep
*.mp4
*.mp3
*.wav
.env
__pycache__/
remotion/node_modules/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/config.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .gitignore pipeline/config.js pipeline/config.test.js
git commit -m "chore: pipeline config defaults + gitignore"
```

---

## Phase 1 — Tested helper libraries

### Task 3: history.js (topic dedup)

**Files:**
- Create: `pipeline/lib/history.js`
- Test: `pipeline/lib/history.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/lib/history.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const { isDuplicate, addEntry, recentTopics } = require("./history");

const hist = { entries: [
  { slug: "octopus-three-hearts", topic: "Octopus hearts", status: "published" },
  { slug: "honey-never-spoils", topic: "Honey never spoils", status: "rejected" },
]};

test("isDuplicate matches by slug case-insensitively", () => {
  assert.strictEqual(isDuplicate(hist, "Octopus-Three-Hearts"), true);
  assert.strictEqual(isDuplicate(hist, "new-slug"), false);
});

test("recentTopics returns topic strings", () => {
  assert.deepStrictEqual(recentTopics(hist), ["Octopus hearts", "Honey never spoils"]);
});

test("addEntry appends without mutating input", () => {
  const next = addEntry(hist, { slug: "x", topic: "X", status: "pending" });
  assert.strictEqual(next.entries.length, 3);
  assert.strictEqual(hist.entries.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/lib/history.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/lib/history.js`
```js
function isDuplicate(history, slug) {
  const s = String(slug).toLowerCase();
  return (history.entries || []).some((e) => e.slug.toLowerCase() === s);
}
function recentTopics(history) {
  return (history.entries || []).map((e) => e.topic);
}
function addEntry(history, entry) {
  return { ...history, entries: [...(history.entries || []), entry] };
}
module.exports = { isDuplicate, recentTopics, addEntry };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/lib/history.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/history.js pipeline/lib/history.test.js
git commit -m "feat: history dedup helpers"
```

---

### Task 4: openrouter.js (JSON extraction)

The network call is injected so the parsing logic is unit-tested.

**Files:**
- Create: `pipeline/lib/openrouter.js`
- Test: `pipeline/lib/openrouter.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/lib/openrouter.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const { extractJSON, chatJSON } = require("./openrouter");

test("extractJSON parses fenced ```json blocks", () => {
  const out = extractJSON('blah\n```json\n{"a":1}\n```\nend');
  assert.deepStrictEqual(out, { a: 1 });
});

test("extractJSON parses raw object", () => {
  assert.deepStrictEqual(extractJSON('  {"b": 2}  '), { b: 2 });
});

test("chatJSON sends prompt and returns parsed JSON", async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
  };
  const res = await chatJSON({ apiKey: "k", model: "m", messages: [{ role: "user", content: "hi" }], fetchImpl: fakeFetch });
  assert.deepStrictEqual(res, { ok: true });
  assert.strictEqual(calls[0].model, "m");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/lib/openrouter.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/lib/openrouter.js`
```js
function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object found in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function chatJSON({ apiKey, model, messages, fetchImpl = fetch, temperature = 0.8 }) {
  const resp = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!resp.ok) throw new Error(`OpenRouter HTTP ${resp.status}`);
  const data = await resp.json();
  return extractJSON(data.choices[0].message.content);
}
module.exports = { extractJSON, chatJSON };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/lib/openrouter.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/openrouter.js pipeline/lib/openrouter.test.js
git commit -m "feat: openrouter client + JSON extraction"
```

---

### Task 5: stock.js (provider fallback)

Provider HTTP fetchers are injected; the fallback orchestration is tested.

**Files:**
- Create: `pipeline/lib/stock.js`
- Test: `pipeline/lib/stock.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/lib/stock.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const { findMedia } = require("./stock");

test("falls back to next provider when first returns null", async () => {
  const providers = {
    pexels: async () => null,
    pixabay: async () => ({ type: "video", url: "http://x/v.mp4" }),
    unsplash: async () => { throw new Error("should not reach"); },
  };
  const r = await findMedia("octopus", ["pexels", "pixabay", "unsplash"], providers);
  assert.deepStrictEqual(r, { type: "video", url: "http://x/v.mp4", provider: "pixabay" });
});

test("returns null when all providers miss", async () => {
  const providers = { pexels: async () => null, pixabay: async () => null, unsplash: async () => null };
  const r = await findMedia("nope", ["pexels", "pixabay", "unsplash"], providers);
  assert.strictEqual(r, null);
});

test("skips a throwing provider and continues", async () => {
  const providers = {
    pexels: async () => { throw new Error("rate limit"); },
    pixabay: async () => ({ type: "image", url: "http://x/i.jpg" }),
  };
  const r = await findMedia("q", ["pexels", "pixabay"], providers);
  assert.strictEqual(r.provider, "pixabay");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/lib/stock.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/lib/stock.js`
```js
// Each provider fn: async (query) => ({ type:"video"|"image", url } | null)
async function findMedia(query, order, providers) {
  for (const name of order) {
    const fn = providers[name];
    if (!fn) continue;
    try {
      const hit = await fn(query);
      if (hit && hit.url) return { ...hit, provider: name };
    } catch (_) { /* try next provider */ }
  }
  return null;
}
module.exports = { findMedia };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/lib/stock.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/stock.js pipeline/lib/stock.test.js
git commit -m "feat: stock provider fallback orchestration"
```

---

### Task 6: stock provider fetchers (Pexels/Pixabay/Unsplash)

Real HTTP query builders for portrait media. URL/param building is tested; the actual `fetch` is injected.

**Files:**
- Create: `pipeline/lib/providers.js`
- Test: `pipeline/lib/providers.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/lib/providers.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const { pexels, pixabay, unsplash } = require("./providers");

test("pexels requests portrait video and maps the best file", async () => {
  let calledUrl, calledHeaders;
  const fakeFetch = async (url, opts) => {
    calledUrl = url; calledHeaders = opts.headers;
    return { ok: true, json: async () => ({ videos: [
      { video_files: [{ width: 1080, height: 1920, link: "http://v/portrait.mp4" }] },
    ] }) };
  };
  const r = await pexels("octopus", { apiKey: "PKEY", fetchImpl: fakeFetch });
  assert.match(calledUrl, /orientation=portrait/);
  assert.match(calledUrl, /query=octopus/);
  assert.strictEqual(calledHeaders.Authorization, "PKEY");
  assert.deepStrictEqual(r, { type: "video", url: "http://v/portrait.mp4" });
});

test("pixabay returns image url when no video", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ hits: [{ largeImageURL: "http://i/p.jpg" }] }) });
  const r = await pixabay("octopus", { apiKey: "K", fetchImpl: fakeFetch, kind: "image" });
  assert.deepStrictEqual(r, { type: "image", url: "http://i/p.jpg" });
});

test("unsplash returns portrait image", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ results: [{ urls: { regular: "http://u/p.jpg" } }] }) });
  const r = await unsplash("octopus", { apiKey: "K", fetchImpl: fakeFetch });
  assert.deepStrictEqual(r, { type: "image", url: "http://u/p.jpg" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/lib/providers.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/lib/providers.js`
```js
function pickPortraitVideo(files) {
  const portrait = files.filter((f) => f.height >= f.width);
  const pool = portrait.length ? portrait : files;
  pool.sort((a, b) => b.height - a.height);
  return pool[0] && pool[0].link;
}

async function pexels(query, { apiKey, fetchImpl = fetch }) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`;
  const r = await fetchImpl(url, { headers: { Authorization: apiKey } });
  if (!r.ok) return null;
  const d = await r.json();
  const vid = (d.videos || [])[0];
  const link = vid && pickPortraitVideo(vid.video_files || []);
  return link ? { type: "video", url: link } : null;
}

async function pixabay(query, { apiKey, fetchImpl = fetch, kind = "video" }) {
  if (kind === "video") {
    const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=5`;
    const r = await fetchImpl(url, {});
    if (r.ok) {
      const d = await r.json();
      const hit = (d.hits || [])[0];
      const link = hit && hit.videos && (hit.videos.large || hit.videos.medium);
      if (link && link.url) return { type: "video", url: link.url };
    }
  }
  const iurl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&per_page=5`;
  const r = await fetchImpl(iurl, {});
  if (!r.ok) return null;
  const d = await r.json();
  const hit = (d.hits || [])[0];
  return hit && hit.largeImageURL ? { type: "image", url: hit.largeImageURL } : null;
}

async function unsplash(query, { apiKey, fetchImpl = fetch }) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5&client_id=${apiKey}`;
  const r = await fetchImpl(url, {});
  if (!r.ok) return null;
  const d = await r.json();
  const hit = (d.results || [])[0];
  return hit && hit.urls ? { type: "image", url: hit.urls.regular } : null;
}

module.exports = { pexels, pixabay, unsplash, pickPortraitVideo };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/lib/providers.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/providers.js pipeline/lib/providers.test.js
git commit -m "feat: stock provider fetchers (pexels/pixabay/unsplash)"
```

---

### Task 7: timeline.js (scene timings + inputProps)

**Files:**
- Create: `pipeline/lib/timeline.js`
- Test: `pipeline/lib/timeline.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/lib/timeline.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const { applyTimings, buildInputProps } = require("./timeline");

test("applyTimings sets cumulative ms windows and total", () => {
  const scenes = [{ id: 1 }, { id: 2 }];
  const out = applyTimings(scenes, [2.0, 3.0]);
  assert.strictEqual(out.scenes[0].audio_start_ms, 0);
  assert.strictEqual(out.scenes[0].audio_end_ms, 2000);
  assert.strictEqual(out.scenes[1].audio_start_ms, 2000);
  assert.strictEqual(out.scenes[1].audio_end_ms, 5000);
  assert.strictEqual(out.total_duration_sec, 5.0);
});

test("buildInputProps converts seconds to frames and wires media", () => {
  const scenesDoc = { scenes: [
    { id: 1, on_screen_text: "A", duration_sec: 2.0 },
    { id: 2, on_screen_text: null, duration_sec: 1.0 },
  ]};
  const media = [ { sceneId: 1, type: "video", file: "scene_01.mp4" },
                  { sceneId: 2, type: "image", file: "scene_02.jpg" } ];
  const props = buildInputProps({
    runId: "r1", scenesDoc, media, captions: [{ text: "hi", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 }],
    theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@c" }, fps: 30,
  });
  assert.strictEqual(props.scenes[0].startFrame, 0);
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.strictEqual(props.scenes[1].startFrame, 60);
  assert.strictEqual(props.scenes[1].durationFrames, 30);
  assert.strictEqual(props.scenes[0].media.src, "r1/scene_01.mp4");
  assert.strictEqual(props.audioSrc, "r1/voiceover.mp3");
  assert.strictEqual(props.scenes[0].onScreenText, "A");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/lib/timeline.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/lib/timeline.js`
```js
function applyTimings(scenes, durationsSec) {
  let cursor = 0;
  const out = scenes.map((s, i) => {
    const dur = durationsSec[i];
    const start = Math.round(cursor * 1000);
    cursor += dur;
    return { ...s, duration_sec: dur, audio_start_ms: start, audio_end_ms: Math.round(cursor * 1000) };
  });
  return { scenes: out, total_duration_sec: Math.round(cursor * 1000) / 1000 };
}

function buildInputProps({ runId, scenesDoc, media, captions, theme, fps }) {
  const byId = new Map(media.map((m) => [m.sceneId, m]));
  let frame = 0;
  const scenes = scenesDoc.scenes.map((s) => {
    const durationFrames = Math.round(s.duration_sec * fps);
    const m = byId.get(s.id);
    const node = {
      id: s.id,
      onScreenText: s.on_screen_text || null,
      startFrame: frame,
      durationFrames,
      media: m ? { type: m.type, src: `${runId}/${m.file}` } : { type: "image", src: "" },
    };
    frame += durationFrames;
    return node;
  });
  return { fps, width: 1080, height: 1920, audioSrc: `${runId}/voiceover.mp3`, theme, captions, scenes };
}
module.exports = { applyTimings, buildInputProps };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/lib/timeline.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/timeline.js pipeline/lib/timeline.test.js
git commit -m "feat: timeline timings + remotion inputProps builder"
```

---

## Phase 2 — Python side-effect scripts

### Task 8: tts.py (edge-tts)

**Files:**
- Create: `scripts/tts.py`
- Create: `requirements.txt`

- [ ] **Step 1: Create requirements.txt**

`requirements.txt`
```
edge-tts==6.1.12
openai-whisper==20231117
google-api-python-client==2.137.0
google-auth-oauthlib==1.2.1
google-auth-httplib2==0.2.0
requests==2.32.3
```

- [ ] **Step 2: Implement tts.py**

`scripts/tts.py`
```python
#!/usr/bin/env python3
"""Synthesize one chunk of text to mp3 with edge-tts.
Usage: python scripts/tts.py --text "..." --voice en-US-ChristopherNeural --rate "+8%" --out file.mp3
"""
import argparse, asyncio
import edge_tts

async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--text", required=True)
    p.add_argument("--voice", default="en-US-ChristopherNeural")
    p.add_argument("--rate", default="+8%")
    p.add_argument("--out", required=True)
    a = p.parse_args()
    communicate = edge_tts.Communicate(a.text, a.voice, rate=a.rate)
    await communicate.save(a.out)
    print(a.out)

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 3: Manual smoke (requires network + edge-tts installed)**

Run: `python scripts/tts.py --text "Octopuses have three hearts." --out /tmp/t.mp3 && ls -la /tmp/t.mp3`
Expected: file exists, non-zero size. (Skip if offline; CI covers it.)

- [ ] **Step 4: Commit**

```bash
git add scripts/tts.py requirements.txt
git commit -m "feat: edge-tts synthesis script"
```

---

### Task 9: transcribe.py (whisper → Caption[])

> **Note:** edge-tts also emits word boundaries; that is a lighter future alternative. The approved spec specifies Whisper, so we implement Whisper here and keep the stage isolated for easy swapping later.

**Files:**
- Create: `scripts/transcribe.py`

- [ ] **Step 1: Implement**

`scripts/transcribe.py`
```python
#!/usr/bin/env python3
"""Transcribe an mp3 to @remotion/captions Caption[] JSON with word timings.
Usage: python scripts/transcribe.py --audio voiceover.mp3 --out captions.json --lang en
"""
import argparse, json
import whisper

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--audio", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--lang", default="en")
    p.add_argument("--model", default="base")
    a = p.parse_args()

    model = whisper.load_model(a.model)
    result = model.transcribe(a.audio, language=a.lang, word_timestamps=True)
    captions = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []):
            start_ms = int(round(w["start"] * 1000))
            end_ms = int(round(w["end"] * 1000))
            captions.append({
                "text": w["word"].strip(),
                "startMs": start_ms,
                "endMs": end_ms,
                "timestampMs": int(round((start_ms + end_ms) / 2)),
                "confidence": w.get("probability", 1),
            })
    with open(a.out, "w") as f:
        json.dump(captions, f, indent=2)
    print(f"{len(captions)} captions -> {a.out}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add scripts/transcribe.py
git commit -m "feat: whisper transcription to remotion captions"
```

---

### Task 10: upload_youtube.py (upload / set-privacy / delete)

**Files:**
- Create: `scripts/upload_youtube.py`

- [ ] **Step 1: Implement**

`scripts/upload_youtube.py`
```python
#!/usr/bin/env python3
"""YouTube ops via refresh-token OAuth. Reads creds from env:
YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN.

Commands:
  upload   --video out.mp4 --meta meta.json --privacy private --out upload.json
  publish  --video-id ID            (set privacyStatus=public)
  delete   --video-id ID
"""
import argparse, json, os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

def service():
    creds = Credentials(
        token=None,
        refresh_token=os.environ["YOUTUBE_REFRESH_TOKEN"],
        client_id=os.environ["YOUTUBE_CLIENT_ID"],
        client_secret=os.environ["YOUTUBE_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/youtube"],
    )
    return build("youtube", "v3", credentials=creds)

def cmd_upload(a):
    meta = json.load(open(a.meta))
    yt = service()
    body = {
        "snippet": {
            "title": meta["title"][:100],
            "description": meta.get("description", ""),
            "tags": meta.get("tags", []),
            "categoryId": str(meta.get("category_id", 27)),
        },
        "status": {"privacyStatus": a.privacy, "selfDeclaredMadeForKids": False},
    }
    media = MediaFileUpload(a.video, chunksize=-1, resumable=True)
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    out = {"video_id": resp["id"], "url": f"https://youtu.be/{resp['id']}", "privacy": a.privacy}
    json.dump(out, open(a.out, "w"), indent=2)
    print(json.dumps(out))

def cmd_publish(a):
    yt = service()
    yt.videos().update(part="status", body={"id": a.video_id, "status": {"privacyStatus": "public"}}).execute()
    print(f"published {a.video_id}")

def cmd_delete(a):
    yt = service()
    yt.videos().delete(id=a.video_id).execute()
    print(f"deleted {a.video_id}")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    u = sub.add_parser("upload"); u.add_argument("--video", required=True); u.add_argument("--meta", required=True)
    u.add_argument("--privacy", default="private"); u.add_argument("--out", required=True); u.set_defaults(fn=cmd_upload)
    pub = sub.add_parser("publish"); pub.add_argument("--video-id", required=True); pub.set_defaults(fn=cmd_publish)
    d = sub.add_parser("delete"); d.add_argument("--video-id", required=True); d.set_defaults(fn=cmd_delete)
    a = p.parse_args(); a.fn(a)

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add scripts/upload_youtube.py
git commit -m "feat: youtube upload/publish/delete script"
```

---

## Phase 3 — Pipeline stages (orchestration)

Each stage exports an async `run({ runId, runRoot, env })` and has a thin CLI tail (`if (require.main === module)`). Pure logic is already tested in Phase 1; these wire helpers + side effects. A small integration test asserts the prompt-building and file-writing for the LLM stages using an injected client.

### Task 11: 01-topic.js

**Files:**
- Create: `pipeline/01-topic.js`
- Test: `pipeline/01-topic.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/01-topic.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { pickTopic } = require("./01-topic");

test("pickTopic asks model avoiding recent topics and writes topic.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topic-"));
  const history = { entries: [{ slug: "honey-never-spoils", topic: "Honey never spoils", status: "published" }] };
  let seenMessages;
  const fakeChat = async ({ messages }) => { seenMessages = messages; return { topic: "Octopus hearts", angle: "biology", why_interesting: "three hearts", slug: "octopus-three-hearts" }; };
  const result = await pickTopic({ runId: "r1", runRoot, history, chat: fakeChat });
  assert.match(JSON.stringify(seenMessages), /Honey never spoils/);
  assert.strictEqual(result.slug, "octopus-three-hearts");
  const written = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "topic.json"), "utf8"));
  assert.strictEqual(written.topic, "Octopus hearts");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/01-topic.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/01-topic.js`
```js
const { writeJSON, runPath } = require("./lib/fsx");
const { recentTopics } = require("./lib/history");

const SYSTEM = "You pick one surprising, well-documented 'fun fact' suitable for a 45-second English YouTube Short. It must be easy to pair with stock footage. Respond ONLY with JSON: {topic, angle, why_interesting, slug}. slug is kebab-case.";

async function pickTopic({ runId, runRoot, history, chat }) {
  const avoid = recentTopics(history);
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Avoid these already-used topics: ${JSON.stringify(avoid)}. Give one fresh, distinct topic.` },
  ];
  const topic = await chat({ messages });
  writeJSON(runPath(runRoot, runId, "topic.json"), topic);
  return topic;
}
module.exports = { pickTopic };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const { readJSON } = require("./lib/fsx");
  const fs = require("node:fs");
  const runId = process.env.RUN_ID;
  const runRoot = process.env.RUN_ROOT || "run";
  const history = fs.existsSync("state/history.json") ? readJSON("state/history.json") : { entries: [] };
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  pickTopic({ runId, runRoot, history, chat }).then((t) => console.log("topic:", t.topic));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/01-topic.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/01-topic.js pipeline/01-topic.test.js
git commit -m "feat: stage 01 topic selection"
```

---

### Task 12: 02-script.js

**Files:**
- Create: `pipeline/02-script.js`
- Test: `pipeline/02-script.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/02-script.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { writeScript } = require("./02-script");

test("writeScript persists scenes.json and meta.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "script-"));
  const topic = { topic: "Octopus hearts", angle: "biology", why_interesting: "three hearts", slug: "octopus-three-hearts" };
  const fakeChat = async () => ({
    hook: "Octopuses have THREE hearts.",
    cta: "Follow for more.",
    scenes: [{ id: 1, narration: "Octopuses have three hearts.", visual_query: "octopus ocean", on_screen_text: "3 HEARTS" }],
    title: "Why Octopuses Have 3 Hearts #shorts",
    description: "A quick fact.",
    tags: ["octopus", "shorts"],
  });
  const r = await writeScript({ runId: "r1", runRoot, topic, chat: fakeChat });
  const scenes = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "scenes.json"), "utf8"));
  const meta = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "meta.json"), "utf8"));
  assert.strictEqual(scenes.scenes[0].visual_query, "octopus ocean");
  assert.strictEqual(scenes.audio_path, "audio/voiceover.mp3");
  assert.match(meta.title, /Octopuses/);
  assert.ok(meta.tags.includes("shorts"));
  assert.strictEqual(r.scenes.scenes.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/02-script.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/02-script.js`
```js
const { writeJSON, runPath } = require("./lib/fsx");

const SYSTEM = `You are a YouTube Shorts scriptwriter. Write a 40-50 second English voiceover, 3-6 scenes.
Rules: 2nd person, short sentences, strong hook in scene 1, numbers spelled where it helps TTS.
Respond ONLY JSON: {hook, cta, scenes:[{id, narration, visual_query, on_screen_text}], title, description, tags}.
visual_query = 2-4 English words for stock search. on_screen_text = short caption or null. title <= 90 chars and ends with " #shorts". tags = 10-20 strings including "shorts".`;

async function writeScript({ runId, runRoot, topic, chat }) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Topic: ${topic.topic}\nAngle: ${topic.angle}\nWhy interesting: ${topic.why_interesting}` },
  ];
  const out = await chat({ messages });
  const scenes = {
    hook: out.hook,
    cta: out.cta,
    audio_path: "audio/voiceover.mp3",
    total_duration_sec: 0,
    scenes: out.scenes.map((s) => ({
      id: s.id, narration: s.narration, visual_query: s.visual_query,
      on_screen_text: s.on_screen_text || null,
      duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0,
    })),
  };
  const meta = { title: out.title, description: out.description, tags: out.tags, category_id: 27 };
  writeJSON(runPath(runRoot, runId, "scenes.json"), scenes);
  writeJSON(runPath(runRoot, runId, "meta.json"), meta);
  return { scenes, meta };
}
module.exports = { writeScript };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const { readJSON } = require("./lib/fsx");
  const runId = process.env.RUN_ID; const runRoot = process.env.RUN_ROOT || "run";
  const topic = readJSON(runPath(runRoot, runId, "topic.json"));
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  writeScript({ runId, runRoot, topic, chat }).then((r) => console.log("scenes:", r.scenes.scenes.length));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/02-script.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/02-script.js pipeline/02-script.test.js
git commit -m "feat: stage 02 scriptwriting + metadata"
```

---

### Task 13: 03-voiceover.js (edge-tts + ffmpeg concat)

Pure timing already covered by `timeline.applyTimings`. This stage wires the shell calls; an injected `synth`, `probeDuration`, and `concat` make it testable without audio.

**Files:**
- Create: `pipeline/lib/sh.js` (shell helpers: synth/probe/concat)
- Create: `pipeline/03-voiceover.js`
- Test: `pipeline/03-voiceover.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/03-voiceover.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { makeVoiceover } = require("./03-voiceover");

test("makeVoiceover synthesizes each scene, concats, writes timings", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vo-"));
  const dir = path.join(runRoot, "r1"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "scenes.json"), JSON.stringify({
    hook: "h", cta: "c", audio_path: "audio/voiceover.mp3", total_duration_sec: 0,
    scenes: [
      { id: 1, narration: "one", visual_query: "q", on_screen_text: null, duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0 },
      { id: 2, narration: "two", visual_query: "q", on_screen_text: null, duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0 },
    ],
  }));
  const synthed = [];
  const deps = {
    synth: async (text, out) => { synthed.push(text); fs.writeFileSync(out, "x"); },
    probeDuration: async () => 2.5,
    concat: async (_files, out) => fs.writeFileSync(out, "joined"),
  };
  const r = await makeVoiceover({ runId: "r1", runRoot, voice: "v", rate: "+8%", deps });
  assert.deepStrictEqual(synthed, ["one", "two"]);
  const scenes = JSON.parse(fs.readFileSync(path.join(dir, "scenes.json"), "utf8"));
  assert.strictEqual(scenes.scenes[1].audio_start_ms, 2500);
  assert.strictEqual(scenes.total_duration_sec, 5.0);
  assert.ok(fs.existsSync(path.join(dir, "audio", "voiceover.mp3")));
  assert.strictEqual(r.total_duration_sec, 5.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/03-voiceover.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/lib/sh.js`
```js
const { spawn } = require("node:child_process");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited ${code}`))));
  });
}
async function synth(text, out, voice, rate) {
  await run("python", ["scripts/tts.py", "--text", text, "--voice", voice, "--rate", rate, "--out", out]);
}
async function probeDuration(file) {
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return parseFloat(out);
}
async function concat(files, out) {
  const listFile = out + ".txt";
  require("node:fs").writeFileSync(listFile, files.map((f) => `file '${require("node:path").resolve(f)}'`).join("\n"));
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", out]);
}
module.exports = { run, synth, probeDuration, concat };
```

`pipeline/03-voiceover.js`
```js
const fs = require("node:fs");
const path = require("node:path");
const { readJSON, writeJSON, runPath } = require("./lib/fsx");
const { applyTimings } = require("./lib/timeline");

async function makeVoiceover({ runId, runRoot, voice, rate, deps }) {
  const scenesPath = runPath(runRoot, runId, "scenes.json");
  const doc = readJSON(scenesPath);
  const audioDir = runPath(runRoot, runId, "audio");
  fs.mkdirSync(audioDir, { recursive: true });

  const sceneFiles = [];
  const durations = [];
  for (const s of doc.scenes) {
    const out = path.join(audioDir, `scene_${String(s.id).padStart(2, "0")}.mp3`);
    await deps.synth(s.narration, out, voice, rate);
    durations.push(await deps.probeDuration(out));
    sceneFiles.push(out);
  }
  const finalOut = path.join(audioDir, "voiceover.mp3");
  await deps.concat(sceneFiles, finalOut);

  const timed = applyTimings(doc.scenes, durations);
  doc.scenes = timed.scenes;
  doc.total_duration_sec = timed.total_duration_sec;
  writeJSON(scenesPath, doc);
  return doc;
}
module.exports = { makeVoiceover };

if (require.main === module) {
  const cfg = require("./config");
  const sh = require("./lib/sh");
  const deps = {
    synth: (t, o, v, r) => sh.synth(t, o, v, r),
    probeDuration: (f) => sh.probeDuration(f),
    concat: (files, o) => sh.concat(files, o),
  };
  makeVoiceover({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", voice: cfg.voice, rate: cfg.ttsRate, deps })
    .then((d) => console.log("voiceover sec:", d.total_duration_sec));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/03-voiceover.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/sh.js pipeline/03-voiceover.js pipeline/03-voiceover.test.js
git commit -m "feat: stage 03 voiceover (edge-tts + ffmpeg concat)"
```

---

### Task 14: 04-captions.js (whisper wrapper)

**Files:**
- Create: `pipeline/04-captions.js`
- Test: `pipeline/04-captions.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/04-captions.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { makeCaptions } = require("./04-captions");

test("makeCaptions calls transcriber with audio + out paths", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cap-"));
  const dir = path.join(runRoot, "r1", "audio"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "voiceover.mp3"), "x");
  let args;
  const transcribe = async (audio, out) => { args = { audio, out }; fs.writeFileSync(out, JSON.stringify([{ text: "hi", startMs: 0, endMs: 1, timestampMs: 0, confidence: 1 }])); };
  const caps = await makeCaptions({ runId: "r1", runRoot, transcribe });
  assert.match(args.audio, /voiceover\.mp3$/);
  assert.match(args.out, /captions\.json$/);
  assert.strictEqual(caps[0].text, "hi");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/04-captions.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/04-captions.js`
```js
const { readJSON, runPath } = require("./lib/fsx");

async function makeCaptions({ runId, runRoot, transcribe }) {
  const audio = runPath(runRoot, runId, "audio", "voiceover.mp3");
  const out = runPath(runRoot, runId, "captions.json");
  await transcribe(audio, out);
  return readJSON(out);
}
module.exports = { makeCaptions };

if (require.main === module) {
  const { run } = require("./lib/sh");
  const transcribe = (audio, out) => run("python", ["scripts/transcribe.py", "--audio", audio, "--out", out, "--lang", "en"]);
  makeCaptions({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", transcribe })
    .then((c) => console.log("captions:", c.length));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/04-captions.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/04-captions.js pipeline/04-captions.test.js
git commit -m "feat: stage 04 captions (whisper wrapper)"
```

---

### Task 15: 05-media.js (download stock per scene)

**Files:**
- Create: `pipeline/lib/download.js`
- Create: `pipeline/05-media.js`
- Test: `pipeline/05-media.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/05-media.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { fetchSceneMedia } = require("./05-media");

test("fetchSceneMedia finds + downloads media per scene and writes media.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "media-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "r1", "scenes.json"), JSON.stringify({
    scenes: [
      { id: 1, visual_query: "octopus", duration_sec: 2 },
      { id: 2, visual_query: "coral", duration_sec: 2 },
    ],
  }));
  const find = async (q) => ({ type: q === "octopus" ? "video" : "image", url: `http://x/${q}`, provider: "pexels" });
  const downloaded = [];
  const download = async (url, dest) => { downloaded.push({ url, dest }); fs.writeFileSync(dest, "bin"); };
  const media = await fetchSceneMedia({ runId: "r1", runRoot, pubRoot, find, download });
  assert.strictEqual(media[0].type, "video");
  assert.strictEqual(media[0].file, "scene_01.mp4");
  assert.strictEqual(media[1].file, "scene_02.jpg");
  assert.ok(fs.existsSync(path.join(pubRoot, "r1", "scene_01.mp4")));
  const written = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "media.json"), "utf8"));
  assert.strictEqual(written.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/05-media.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/lib/download.js`
```js
const fs = require("node:fs");
async function download(url, dest, fetchImpl = fetch) {
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(`download HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
}
module.exports = { download };
```

`pipeline/05-media.js`
```js
const fs = require("node:fs");
const path = require("node:path");
const { readJSON, writeJSON, runPath } = require("./lib/fsx");

async function fetchSceneMedia({ runId, runRoot, pubRoot, find, download }) {
  const doc = readJSON(runPath(runRoot, runId, "scenes.json"));
  const destDir = path.join(pubRoot, runId);
  fs.mkdirSync(destDir, { recursive: true });

  const media = [];
  for (const s of doc.scenes) {
    const hit = await find(s.visual_query);
    if (!hit) throw new Error(`no stock media for scene ${s.id} ("${s.visual_query}")`);
    const ext = hit.type === "video" ? "mp4" : "jpg";
    const file = `scene_${String(s.id).padStart(2, "0")}.${ext}`;
    await download(hit.url, path.join(destDir, file));
    media.push({ sceneId: s.id, type: hit.type, file, provider: hit.provider });
  }
  writeJSON(runPath(runRoot, runId, "media.json"), media);
  return media;
}
module.exports = { fetchSceneMedia };

if (require.main === module) {
  const cfg = require("./config");
  const { findMedia } = require("./lib/stock");
  const providers = require("./lib/providers");
  const { download } = require("./lib/download");
  const provFns = {
    pexels: (q) => providers.pexels(q, { apiKey: process.env.PEXELS_API_KEY }),
    pixabay: (q) => providers.pixabay(q, { apiKey: process.env.PIXABAY_API_KEY }),
    unsplash: (q) => providers.unsplash(q, { apiKey: process.env.UNSPLASH_API_KEY }),
  };
  const find = (q) => findMedia(q, cfg.stockOrder, provFns);
  fetchSceneMedia({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", pubRoot: "remotion/public", find, download })
    .then((m) => console.log("media:", m.length));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/05-media.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/download.js pipeline/05-media.js pipeline/05-media.test.js
git commit -m "feat: stage 05 stock media download"
```

---

## Phase 4 — Remotion render layer

### Task 16: Remotion project scaffold + Zod schema

**Files:**
- Create: `remotion/package.json`
- Create: `remotion/tsconfig.json`
- Create: `remotion/remotion.config.ts`
- Create: `remotion/src/schema.ts`
- Create: `remotion/public/.gitkeep`

- [ ] **Step 1: Create package + config**

`remotion/package.json`
```json
{
  "name": "remo-remotion",
  "private": true,
  "scripts": { "studio": "remotion studio", "lint": "tsc --noEmit" },
  "dependencies": {
    "@remotion/captions": "^4.0.0",
    "@remotion/cli": "^4.0.0",
    "@remotion/google-fonts": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "^4.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

`remotion/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020", "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "strict": true, "esModuleInterop": true,
    "skipLibCheck": true, "noEmit": true
  },
  "include": ["src"]
}
```

`remotion/remotion.config.ts`
```ts
import { Config } from "@remotion/cli/config";
Config.setVideoImageFormat("jpeg");
Config.setConcurrency(2);
```

`remotion/public/.gitkeep` — empty file.

- [ ] **Step 2: Implement schema**

`remotion/src/schema.ts`
```ts
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
```

- [ ] **Step 3: Install + type-check**

Run: `cd remotion && npm install && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add remotion/package.json remotion/tsconfig.json remotion/remotion.config.ts remotion/src/schema.ts remotion/public/.gitkeep
git commit -m "chore: remotion scaffold + zod schema"
```

---

### Task 17: Pure animation helpers (anim.ts)

These are the only logic-bearing Remotion pieces, so they get unit tests runnable with `node --test` after a tiny TS→JS compile-free approach: we write them as framework-free pure functions and test via a `.test.mjs` that imports compiled output. To keep zero-build testing, implement helpers in plain TS but test the algorithm in a co-located JS mirror is overkill — instead test through `tsx`. Simpler: write helpers in `anim.ts` and a Node test that requires a `.cjs` build is heavy. **Decision:** implement helpers as pure functions and verify with `tsc --noEmit` + a lightweight `node --test` using `tsx` loader.

**Files:**
- Create: `remotion/src/lib/anim.ts`
- Test: `remotion/src/lib/anim.test.ts`
- Modify: `remotion/package.json` (add `tsx` dev dep + test script)

- [ ] **Step 1: Add tsx + test script**

In `remotion/package.json` add to `devDependencies`: `"tsx": "^4.16.0"` and to `scripts`: `"test": "node --import tsx --test src/**/*.test.ts"`.

- [ ] **Step 2: Write the failing test**

`remotion/src/lib/anim.test.ts`
```ts
import test from "node:test";
import assert from "node:assert";
import { kenBurnsScale, fadeOpacity, activeCaptionIndex } from "./anim";

test("kenBurnsScale goes 1 → 1.08 across duration", () => {
  assert.strictEqual(kenBurnsScale(0, 100), 1);
  assert.ok(Math.abs(kenBurnsScale(100, 100) - 1.08) < 1e-9);
});

test("fadeOpacity ramps 0→1 over fadeFrames then clamps", () => {
  assert.strictEqual(fadeOpacity(0, 8), 0);
  assert.strictEqual(fadeOpacity(8, 8), 1);
  assert.strictEqual(fadeOpacity(40, 8), 1);
});

test("activeCaptionIndex finds caption covering the ms, else -1", () => {
  const caps = [
    { text: "a", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 },
    { text: "b", startMs: 500, endMs: 1000, timestampMs: 750, confidence: 1 },
  ];
  assert.strictEqual(activeCaptionIndex(caps, 250), 0);
  assert.strictEqual(activeCaptionIndex(caps, 600), 1);
  assert.strictEqual(activeCaptionIndex(caps, 2000), -1);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd remotion && npm install && npm test`
Expected: FAIL — `./anim` not found.

- [ ] **Step 4: Implement**

`remotion/src/lib/anim.ts`
```ts
import type { CaptionItem } from "../schema";

export function kenBurnsScale(frame: number, durationFrames: number): number {
  if (durationFrames <= 0) return 1;
  const t = Math.min(Math.max(frame / durationFrames, 0), 1);
  return 1 + 0.08 * t;
}

export function fadeOpacity(frame: number, fadeFrames: number): number {
  if (fadeFrames <= 0) return 1;
  return Math.min(Math.max(frame / fadeFrames, 0), 1);
}

export function activeCaptionIndex(captions: CaptionItem[], ms: number): number {
  return captions.findIndex((c) => ms >= c.startMs && ms < c.endMs);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd remotion && npm test`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add remotion/src/lib/anim.ts remotion/src/lib/anim.test.ts remotion/package.json
git commit -m "feat: pure remotion animation helpers + tests"
```

---

### Task 18: Components — Scene, ProgressBar, OnScreenText

**Files:**
- Create: `remotion/src/components/Scene.tsx`
- Create: `remotion/src/components/OnScreenText.tsx`
- Create: `remotion/src/components/ProgressBar.tsx`

- [ ] **Step 1: Implement Scene.tsx**

`remotion/src/components/Scene.tsx`
```tsx
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { kenBurnsScale, fadeOpacity } from "../lib/anim";
import type { SceneNode } from "../schema";

export const Scene: React.FC<{ scene: SceneNode }> = ({ scene }) => {
  const frame = useCurrentFrame(); // local frame (Sequence-relative)
  const scale = kenBurnsScale(frame, scene.durationFrames);
  const opacity = fadeOpacity(frame, 8);
  const src = staticFile(scene.media.src);
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        {scene.media.type === "video" ? (
          <Video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
        ) : (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Implement OnScreenText.tsx**

`remotion/src/components/OnScreenText.tsx`
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const OnScreenText: React.FC<{ text: string; fontFamily: string; accentColor: string }> = ({
  text, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(frame, [0, 10], [20, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 180 }}>
      <div
        style={{
          opacity, transform: `translateY(${translateY}px)`,
          fontFamily, fontSize: 84, color: "white", fontWeight: 800,
          textAlign: "center", padding: "12px 28px",
          background: accentColor, borderRadius: 14, maxWidth: "85%",
          textShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Implement ProgressBar.tsx**

`remotion/src/components/ProgressBar.tsx`
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const ProgressBar: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const width = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ height: 8, width: `${width}%`, background: accentColor }} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Type-check**

Run: `cd remotion && npx tsc --noEmit`
Expected: no errors. (Add `@remotion/media` to `remotion/package.json` dependencies as `"@remotion/media": "^4.0.0"` and re-run `npm install` if the import is unresolved.)

- [ ] **Step 5: Commit**

```bash
git add remotion/src/components/Scene.tsx remotion/src/components/OnScreenText.tsx remotion/src/components/ProgressBar.tsx remotion/package.json
git commit -m "feat: Scene, OnScreenText, ProgressBar components"
```

---

### Task 19: Captions component

**Files:**
- Create: `remotion/src/components/Captions.tsx`

- [ ] **Step 1: Implement**

`remotion/src/components/Captions.tsx`
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { activeCaptionIndex } from "../lib/anim";
import type { CaptionItem } from "../schema";

const WINDOW = 4; // words shown around the active word

export const Captions: React.FC<{ captions: CaptionItem[]; fontFamily: string; accentColor: string }> = ({
  captions, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const active = activeCaptionIndex(captions, ms);
  if (active === -1) return null;

  const start = Math.max(0, active - WINDOW);
  const end = Math.min(captions.length, active + WINDOW + 1);
  const window = captions.slice(start, end);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 360 }}>
      <div
        style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12,
          maxWidth: "88%", textAlign: "center",
        }}
      >
        {window.map((c, i) => {
          const isActive = start + i === active;
          return (
            <span
              key={start + i}
              style={{
                fontFamily, fontSize: 72, fontWeight: 800, lineHeight: 1.1,
                color: isActive ? accentColor : "white",
                opacity: isActive ? 1 : 0.6,
                WebkitTextStroke: "3px black",
                paintOrder: "stroke fill",
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

- [ ] **Step 2: Type-check**

Run: `cd remotion && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/components/Captions.tsx
git commit -m "feat: word-synced captions component"
```

---

### Task 20: Short.tsx + Root.tsx + calculateMetadata

**Files:**
- Create: `remotion/src/Short.tsx`
- Create: `remotion/src/Root.tsx`
- Create: `remotion/src/index.ts`

- [ ] **Step 1: Implement Short.tsx**

`remotion/src/Short.tsx`
```tsx
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
```

- [ ] **Step 2: Implement Root.tsx**

`remotion/src/Root.tsx`
```tsx
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
```

`remotion/src/index.ts`
```ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);
```

- [ ] **Step 3: Type-check + Studio smoke**

Run: `cd remotion && npx tsc --noEmit`
Expected: no errors.
(Optional, where a browser is available: `npx remotion studio` and confirm the "Short" composition loads with default props.)

- [ ] **Step 4: Commit**

```bash
git add remotion/src/Short.tsx remotion/src/Root.tsx remotion/src/index.ts
git commit -m "feat: Short composition + Root with dynamic duration"
```

---

### Task 21: 06-render.js (programmatic render)

**Files:**
- Create: `pipeline/06-render.js`
- Test: `pipeline/06-render.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/06-render.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { prepareRender } = require("./06-render");

test("prepareRender copies audio into public and builds props with frames", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rnd-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpub-"));
  const dir = path.join(runRoot, "r1"); fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.mkdirSync(path.join(pubRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(dir, "audio", "voiceover.mp3"), "AUDIO");
  fs.writeFileSync(path.join(dir, "scenes.json"), JSON.stringify({
    scenes: [{ id: 1, on_screen_text: "A", duration_sec: 2.0 }], total_duration_sec: 2.0,
  }));
  fs.writeFileSync(path.join(dir, "media.json"), JSON.stringify([{ sceneId: 1, type: "video", file: "scene_01.mp4" }]));
  fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify([{ text: "hi", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 }]));

  const props = prepareRender({ runId: "r1", runRoot, pubRoot, theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@c" }, fps: 30 });
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.strictEqual(props.audioSrc, "r1/voiceover.mp3");
  assert.strictEqual(fs.readFileSync(path.join(pubRoot, "r1", "voiceover.mp3"), "utf8"), "AUDIO");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/06-render.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/06-render.js`
```js
const fs = require("node:fs");
const path = require("node:path");
const { readJSON, runPath } = require("./lib/fsx");
const { buildInputProps } = require("./lib/timeline");

function prepareRender({ runId, runRoot, pubRoot, theme, fps }) {
  const scenesDoc = readJSON(runPath(runRoot, runId, "scenes.json"));
  const media = readJSON(runPath(runRoot, runId, "media.json"));
  const captions = readJSON(runPath(runRoot, runId, "captions.json"));

  // audio lives in run/<id>/audio/voiceover.mp3 → copy into public/<id>/voiceover.mp3
  const srcAudio = runPath(runRoot, runId, "audio", "voiceover.mp3");
  const destAudio = path.join(pubRoot, runId, "voiceover.mp3");
  fs.mkdirSync(path.dirname(destAudio), { recursive: true });
  fs.copyFileSync(srcAudio, destAudio);

  return buildInputProps({ runId, scenesDoc, media, captions, theme, fps });
}

async function render({ runId, runRoot, pubRoot, theme, fps, outFile }) {
  const inputProps = prepareRender({ runId, runRoot, pubRoot, theme, fps });
  const { bundle } = require("@remotion/bundler");
  const { renderMedia, selectComposition } = require("@remotion/renderer");
  const serveUrl = await bundle({ entryPoint: path.resolve("remotion/src/index.ts") });
  const composition = await selectComposition({ serveUrl, id: "Short", inputProps });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: outFile, inputProps });
  return outFile;
}
module.exports = { prepareRender, render };

if (require.main === module) {
  const cfg = require("./config");
  const runId = process.env.RUN_ID;
  const outFile = path.join("out", `${runId}.mp4`);
  render({ runId, runRoot: process.env.RUN_ROOT || "run", pubRoot: "remotion/public", theme: cfg.theme, fps: cfg.render.fps, outFile })
    .then((f) => console.log("rendered:", f));
}
```

Add `"@remotion/bundler": "^4.0.0"` to `remotion/package.json` dependencies (used by the renderer at the repo root via `remotion/node_modules`). Install root render deps in CI (Task 24).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/06-render.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/06-render.js pipeline/06-render.test.js remotion/package.json
git commit -m "feat: stage 06 programmatic remotion render"
```

---

### Task 22: run.js orchestrator

**Files:**
- Create: `pipeline/run.js`
- Test: `pipeline/run.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/run.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const { makeRunId } = require("./run");

test("makeRunId formats run-YYYYMMDD-HHMMSS from a Date", () => {
  const d = new Date(Date.UTC(2026, 5, 11, 8, 53, 14));
  assert.strictEqual(makeRunId(d), "run-20260611-085314");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pipeline/run.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement**

`pipeline/run.js`
```js
const fs = require("node:fs");
const cfg = require("./config");
const { readJSON, writeJSON } = require("./lib/fsx");
const { isDuplicate, addEntry } = require("./lib/history");
const { chatJSON } = require("./lib/openrouter");
const { pickTopic } = require("./01-topic");
const { writeScript } = require("./02-script");
const { makeVoiceover } = require("./03-voiceover");
const { makeCaptions } = require("./04-captions");
const { fetchSceneMedia } = require("./05-media");
const { render } = require("./06-render");
const sh = require("./lib/sh");
const { findMedia } = require("./lib/stock");
const providers = require("./lib/providers");
const { download } = require("./lib/download");

function pad(n) { return String(n).padStart(2, "0"); }
function makeRunId(d) {
  return `run-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

async function main() {
  const runRoot = process.env.RUN_ROOT || "run";
  const runId = process.env.RUN_ID || makeRunId(new Date());
  const historyPath = "state/history.json";
  const history = fs.existsSync(historyPath) ? readJSON(historyPath) : { entries: [] };
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });

  let topic;
  for (let attempt = 0; attempt < 3; attempt++) {
    topic = await pickTopic({ runId, runRoot, history, chat });
    if (!isDuplicate(history, topic.slug)) break;
    console.log("duplicate topic, retrying:", topic.slug);
  }

  await writeScript({ runId, runRoot, topic, chat });

  const voDeps = { synth: sh.synth, probeDuration: sh.probeDuration, concat: sh.concat };
  await makeVoiceover({ runId, runRoot, voice: cfg.voice, rate: cfg.ttsRate, deps: voDeps });

  const transcribe = (audio, out) => sh.run("python", ["scripts/transcribe.py", "--audio", audio, "--out", out, "--lang", "en"]);
  await makeCaptions({ runId, runRoot, transcribe });

  const provFns = {
    pexels: (q) => providers.pexels(q, { apiKey: process.env.PEXELS_API_KEY }),
    pixabay: (q) => providers.pixabay(q, { apiKey: process.env.PIXABAY_API_KEY }),
    unsplash: (q) => providers.unsplash(q, { apiKey: process.env.UNSPLASH_API_KEY }),
  };
  const find = (q) => findMedia(q, cfg.stockOrder, provFns);
  await fetchSceneMedia({ runId, runRoot, pubRoot: "remotion/public", find, download });

  const outFile = `out/${runId}.mp4`;
  await render({ runId, runRoot, pubRoot: "remotion/public", theme: cfg.theme, fps: cfg.render.fps, outFile });

  const nextHistory = addEntry(history, { slug: topic.slug, topic: topic.topic, status: "pending", runId });
  writeJSON(historyPath, nextHistory);
  console.log(JSON.stringify({ runId, topic: topic.topic, outFile }));
}

module.exports = { makeRunId, main };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pipeline/run.test.js`
Expected: PASS

- [ ] **Step 5: Run the whole suite**

Run: `node --test pipeline/**/*.test.js`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add pipeline/run.js pipeline/run.test.js
git commit -m "feat: pipeline orchestrator (01->06)"
```

---

## Phase 5 — CI workflows + docs

### Task 23: state/history.json seed + secrets doc

**Files:**
- Create: `state/history.json`
- Create: `docs/SECRETS.md`

- [ ] **Step 1: Seed history**

`state/history.json`
```json
{ "entries": [] }
```

- [ ] **Step 2: Document required GitHub Secrets**

`docs/SECRETS.md`
```markdown
# GitHub Secrets (Repo → Settings → Secrets and variables → Actions)

Copy values from otomasyon/.env:

| Secret | Source key in otomasyon/.env |
|---|---|
| OPENROUTER_API_KEY | OPENROUTER_API_KEY |
| PEXELS_API_KEY | PEXELS_API_KEY |
| PIXABAY_API_KEY | PIXABAY_API_KEY |
| UNSPLASH_API_KEY | UNSPLASH_API_KEY |
| YOUTUBE_CLIENT_ID | YOUTUBE_CLIENT_ID |
| YOUTUBE_CLIENT_SECRET | YOUTUBE_CLIENT_SECRET |
| YOUTUBE_REFRESH_TOKEN | YOUTUBE_REFRESH_TOKEN |

Trigger production: `gh workflow run produce.yml`
Approve:  `gh workflow run publish.yml -f video_id=<ID> -f action=approve`
Reject:   `gh workflow run publish.yml -f video_id=<ID> -f action=reject`
```

- [ ] **Step 3: Commit**

```bash
git add state/history.json docs/SECRETS.md
git commit -m "docs: secrets + history seed"
```

---

### Task 24: produce.yml

**Files:**
- Create: `.github/workflows/produce.yml`

- [ ] **Step 1: Implement**

`.github/workflows/produce.yml`
```yaml
name: produce
on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  produce:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - name: Install ffmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg
      - name: Install Python deps
        run: pip install -r requirements.txt
      - name: Install root render deps
        run: npm install
      - name: Install Remotion deps
        run: cd remotion && npm install
      - name: Run pipeline (topic -> render)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
          PIXABAY_API_KEY: ${{ secrets.PIXABAY_API_KEY }}
          UNSPLASH_API_KEY: ${{ secrets.UNSPLASH_API_KEY }}
        run: node pipeline/run.js
      - name: Capture run id
        id: runid
        run: echo "id=$(ls -t run | head -1)" >> "$GITHUB_OUTPUT"
      - name: Upload to YouTube (private)
        env:
          YOUTUBE_CLIENT_ID: ${{ secrets.YOUTUBE_CLIENT_ID }}
          YOUTUBE_CLIENT_SECRET: ${{ secrets.YOUTUBE_CLIENT_SECRET }}
          YOUTUBE_REFRESH_TOKEN: ${{ secrets.YOUTUBE_REFRESH_TOKEN }}
        run: |
          ID=${{ steps.runid.outputs.id }}
          python scripts/upload_youtube.py upload \
            --video out/$ID.mp4 \
            --meta run/$ID/meta.json \
            --privacy private \
            --out run/$ID/upload.json
          cat run/$ID/upload.json
      - name: Persist upload result + history
        run: |
          ID=${{ steps.runid.outputs.id }}
          node -e "const fs=require('fs');const u=require('./run/'+process.env.ID+'/upload.json');const h=require('./state/history.json');const e=h.entries.find(x=>x.runId===process.env.ID);if(e){e.video_id=u.video_id;e.url=u.url;}fs.writeFileSync('state/history.json',JSON.stringify(h,null,2));" 
        env: { ID: "${{ steps.runid.outputs.id }}" }
      - name: Commit state
        run: |
          git config user.name "remo-bot"
          git config user.email "bot@remo"
          git add state/history.json run/${{ steps.runid.outputs.id }}/upload.json || true
          git commit -m "run ${{ steps.runid.outputs.id }} uploaded (private)" || echo "nothing to commit"
          git push || echo "push skipped"
      - name: Upload video artifact
        uses: actions/upload-artifact@v4
        with:
          name: short-${{ steps.runid.outputs.id }}
          path: out/${{ steps.runid.outputs.id }}.mp4
```

- [ ] **Step 2: Validate YAML locally**

Run: `node -e "require('node:fs').readFileSync('.github/workflows/produce.yml','utf8')" && echo OK`
Expected: OK (file readable). Full validation occurs on first dispatch.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/produce.yml
git commit -m "ci: produce workflow"
```

---

### Task 25: publish.yml

**Files:**
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Implement**

`.github/workflows/publish.yml`
```yaml
name: publish
on:
  workflow_dispatch:
    inputs:
      video_id:
        description: "YouTube video id"
        required: true
      action:
        description: "approve or reject"
        required: true
        default: "approve"

permissions:
  contents: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - name: Install Python deps
        run: pip install -r requirements.txt
      - name: Approve or reject
        env:
          YOUTUBE_CLIENT_ID: ${{ secrets.YOUTUBE_CLIENT_ID }}
          YOUTUBE_CLIENT_SECRET: ${{ secrets.YOUTUBE_CLIENT_SECRET }}
          YOUTUBE_REFRESH_TOKEN: ${{ secrets.YOUTUBE_REFRESH_TOKEN }}
        run: |
          if [ "${{ inputs.action }}" = "approve" ]; then
            python scripts/upload_youtube.py publish --video-id "${{ inputs.video_id }}"
          else
            python scripts/upload_youtube.py delete --video-id "${{ inputs.video_id }}"
          fi
      - name: Update history status
        run: |
          node -e "const fs=require('fs');const h=require('./state/history.json');const e=h.entries.find(x=>x.video_id===process.env.VID);if(e){e.status=process.env.ACT==='approve'?'published':'rejected';}fs.writeFileSync('state/history.json',JSON.stringify(h,null,2));"
        env:
          VID: "${{ inputs.video_id }}"
          ACT: "${{ inputs.action }}"
      - name: Commit
        run: |
          git config user.name "remo-bot"
          git config user.email "bot@remo"
          git add state/history.json || true
          git commit -m "publish ${{ inputs.action }} ${{ inputs.video_id }}" || echo "nothing"
          git push || echo "push skipped"
```

- [ ] **Step 2: Validate YAML readable**

Run: `node -e "require('node:fs').readFileSync('.github/workflows/publish.yml','utf8')" && echo OK`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: publish (approve/reject) workflow"
```

---

### Task 26: README + final suite run

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

`README.md`
```markdown
# remo — English Fun-Facts Shorts Factory

One-trigger pipeline: topic → script → TTS → captions → stock media → Remotion render → private YouTube upload. Approve/reject from your phone via GitHub Actions.

## Run
- Produce: `gh workflow run produce.yml`
- Approve: `gh workflow run publish.yml -f video_id=<ID> -f action=approve`
- Reject:  `gh workflow run publish.yml -f video_id=<ID> -f action=reject`

## Local dev
- `npm test` — pipeline unit tests (node:test)
- `cd remotion && npm test` — animation helper tests
- `cd remotion && npx remotion studio` — preview (needs desktop browser)

## Config
Edit `pipeline/config.js` (voice, theme, model, stock order).

See `docs/SECRETS.md` for required GitHub Secrets.
```

- [ ] **Step 2: Run full test suite**

Run: `node --test pipeline/**/*.test.js && cd remotion && npm test`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README"
```

---

## Verification Checklist (post-implementation)

- [ ] `node --test pipeline/**/*.test.js` → all green
- [ ] `cd remotion && npm test` → all green
- [ ] `cd remotion && npx tsc --noEmit` → no type errors
- [ ] GitHub Secrets populated per `docs/SECRETS.md`
- [ ] First `gh workflow run produce.yml` → produces `out/<id>.mp4` + private upload
- [ ] Video is 1080×1920, <60s, captioned, ≥3 scenes with stock media (download artifact and inspect)
- [ ] `publish.yml approve` flips the video to public; `reject` deletes it
- [ ] `state/history.json` updated; re-running does not repeat the same slug
- [ ] otomasyon/ untouched and still functional
```
