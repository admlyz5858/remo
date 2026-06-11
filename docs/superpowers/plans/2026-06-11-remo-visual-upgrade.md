# remo Visual/Audio Upgrade (Viral Kinetic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix repeating stock media and turn the plain Short into a viral/kinetic video: distinct non-repeating media (video-first), word-popping captions, per-scene entrance animations, animated hook title, motion-graphics over photos, seeded per-video variety, and background music.

**Architecture:** Pipeline stages gain a candidate-pool + run-scoped dedup for media, distinct LLM visual queries with a fallback, and seeded choices (accent color, per-scene entrance variant, music track) computed in `buildInputProps`/`prepareRender` and passed to Remotion via `inputProps`. Remotion consumes those props deterministically; all motion is `useCurrentFrame`/`interpolate` plus pure tested curve helpers (no `@remotion/transitions` — entrance animations preserve exact audio length and caption sync).

**Tech Stack:** Node 20 CommonJS + `node:test`, Remotion 4.x, `@remotion/media` (Audio/Video), `@remotion/google-fonts`, Zod, ffmpeg, edge-tts. No new npm dependency.

---

## Key decisions (locked)

- **No `@remotion/transitions`.** Cross-scene transitions would shorten the composition (`Σscenes − Σtransitions`) and cut off the end of the voiceover. Instead each scene plays an **entrance animation** in its first ~8 frames over a hard cut; composition duration stays `Σ durationFrames` = audio length, so captions and audio stay perfectly synced.
- **All seeded choices computed in the pipeline** (`buildInputProps`/`prepareRender`) from `runId`, passed via `inputProps`. Remotion stays a pure function of its props.
- **Pure curve helpers** in `remotion/src/lib/anim.ts` are unit-tested (`anim.test.ts` runs in CI; locally verify math with a throwaway `~/anim_check.cjs` since `remotion/` can't `npm install` on Termux FAT).

## Data contract additions

`scenes[].visual_query_alt` (string, optional) — fallback stock query (stage 02).

`media.json` unchanged: `[{ sceneId, type:"video"|"image", file, provider }]`.

Remotion `inputProps` (built by `buildInputProps`) gains:
```json
{ "musicSrc": "<run-id>/music.mp3" | null,
  "musicVolume": 0.1,
  "theme": { "accentColor": "<seeded>", "fontFamily": "Anton", "channelName": "@channel" },
  "scenes": [ { "...": "...", "transition": "slideLeft|slideUp|zoomIn|fade" } ] }
```

---

## File Structure

| File | Change |
|---|---|
| `pipeline/lib/providers.js` | add `*Candidates` list-returning fns (video + photo kinds) |
| `pipeline/lib/stock.js` | add `findMediaCandidates(query, order, providers)` |
| `pipeline/lib/seed.js` | (new) `hashSeed`, `seededInt`, `pickFrom`, `pickMusic` |
| `pipeline/lib/timeline.js` | `buildInputProps` gains seed/accent/transition/music params |
| `pipeline/02-script.js` | prompt: distinct `visual_query` + `visual_query_alt` |
| `pipeline/05-media.js` | candidate pool + run dedup + video-first + alt query |
| `pipeline/06-render.js` | `prepareRender` selects music + passes seed/palette/transitions |
| `pipeline/config.js` | `accentPalette`, `transitions`, `music` |
| `pipeline/run.js` | (no change needed; render() reads config) |
| `.gitignore` | un-ignore `remotion/public/music/` |
| `remotion/src/lib/anim.ts` | `popScale`, `punchZoom`, `staggerReveal`, `transitionStyle` |
| `remotion/src/schema.ts` | `musicSrc`, `musicVolume`, scene `transition` |
| `remotion/src/components/KineticCaptions.tsx` | (new) word-pop captions |
| `remotion/src/components/TitleCard.tsx` | (new) hook reveal |
| `remotion/src/components/MotionBackground.tsx` | (new) photo motion graphics |
| `remotion/src/components/Scene.tsx` | entrance + zoom-punch + photo bg |
| `remotion/src/components/ProgressBar.tsx` | stylized |
| `remotion/src/Short.tsx` | pass accent, music Audio, KineticCaptions, TitleCard |
| `remotion/src/Root.tsx` | defaultProps add musicSrc/musicVolume |
| `remotion/public/music/README.md` | how to add royalty-free tracks |

---

## Phase A — Pipeline: diversity, media, seed, music

### Task 1: Provider candidate lists

**Files:**
- Modify: `pipeline/lib/providers.js`
- Test: `pipeline/lib/providers.test.js` (add tests)

- [ ] **Step 1: Add failing tests** (append to `pipeline/lib/providers.test.js`)

```js
const { pexelsVideoCandidates, pixabayVideoCandidates, pixabayPhotoCandidates, unsplashCandidates } = require("./providers");

test("pexelsVideoCandidates returns up to N portrait video candidates with ids", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ videos: [
    { id: 11, video_files: [{ width: 1080, height: 1920, link: "http://v/a.mp4" }] },
    { id: 22, video_files: [{ width: 720, height: 1280, link: "http://v/b.mp4" }] },
  ] }) });
  const r = await pexelsVideoCandidates("octopus", { apiKey: "K", fetchImpl: fakeFetch });
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r[0], { type: "video", url: "http://v/a.mp4", id: "11" });
});

test("unsplashCandidates returns portrait image candidates", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ results: [
    { id: "u1", urls: { regular: "http://u/1.jpg" } },
    { id: "u2", urls: { regular: "http://u/2.jpg" } },
  ] }) });
  const r = await unsplashCandidates("octopus", { apiKey: "K", fetchImpl: fakeFetch });
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r[1], { type: "image", url: "http://u/2.jpg", id: "u2" });
});

test("pixabay candidates: video + photo variants", async () => {
  const vids = async () => ({ ok: true, json: async () => ({ hits: [{ id: 5, videos: { large: { url: "http://p/v.mp4" } } }] }) });
  const v = await pixabayVideoCandidates("q", { apiKey: "K", fetchImpl: vids });
  assert.deepStrictEqual(v[0], { type: "video", url: "http://p/v.mp4", id: "5" });
  const pics = async () => ({ ok: true, json: async () => ({ hits: [{ id: 9, largeImageURL: "http://p/i.jpg" }] }) });
  const p = await pixabayPhotoCandidates("q", { apiKey: "K", fetchImpl: pics });
  assert.deepStrictEqual(p[0], { type: "image", url: "http://p/i.jpg", id: "9" });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/lib/providers.test.js`
Expected: FAIL — `pexelsVideoCandidates is not a function`.

- [ ] **Step 3: Implement** (append these functions in `pipeline/lib/providers.js`, before `module.exports`)

```js
async function pexelsVideoCandidates(query, { apiKey, fetchImpl = fetch, perPage = 5 }) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${perPage}`;
  const r = await fetchImpl(url, { headers: { Authorization: apiKey } });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.videos || [])
    .map((v) => ({ link: pickPortraitVideo(v.video_files || []), id: String(v.id) }))
    .filter((x) => x.link)
    .map((x) => ({ type: "video", url: x.link, id: x.id }));
}

async function pixabayVideoCandidates(query, { apiKey, fetchImpl = fetch, perPage = 5 }) {
  const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${perPage}`;
  const r = await fetchImpl(url, {});
  if (!r.ok) return [];
  const d = await r.json();
  return (d.hits || [])
    .map((h) => ({ link: h.videos && (h.videos.large || h.videos.medium), id: String(h.id) }))
    .filter((x) => x.link && x.link.url)
    .map((x) => ({ type: "video", url: x.link.url, id: x.id }));
}

async function pixabayPhotoCandidates(query, { apiKey, fetchImpl = fetch, perPage = 5 }) {
  const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&per_page=${perPage}`;
  const r = await fetchImpl(url, {});
  if (!r.ok) return [];
  const d = await r.json();
  return (d.hits || [])
    .filter((h) => h.largeImageURL)
    .map((h) => ({ type: "image", url: h.largeImageURL, id: String(h.id) }));
}

async function unsplashCandidates(query, { apiKey, fetchImpl = fetch, perPage = 5 }) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${perPage}&client_id=${apiKey}`;
  const r = await fetchImpl(url, {});
  if (!r.ok) return [];
  const d = await r.json();
  return (d.results || [])
    .filter((h) => h.urls && h.urls.regular)
    .map((h) => ({ type: "image", url: h.urls.regular, id: String(h.id) }));
}
```

And update the exports line to include them:
```js
module.exports = { pexels, pixabay, unsplash, pickPortraitVideo,
  pexelsVideoCandidates, pixabayVideoCandidates, pixabayPhotoCandidates, unsplashCandidates };
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test pipeline/lib/providers.test.js`
Expected: PASS (original 3 + new 3).

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/providers.js pipeline/lib/providers.test.js
git commit -m "feat: provider candidate lists (video+photo)"
```

---

### Task 2: findMediaCandidates (dedup-able pool)

**Files:**
- Modify: `pipeline/lib/stock.js`
- Test: `pipeline/lib/stock.test.js` (add test)

- [ ] **Step 1: Add failing test**

```js
const { findMediaCandidates } = require("./stock");

test("findMediaCandidates flattens providers in order, tagging provider", async () => {
  const providers = {
    pexelsVideo: async () => [{ type: "video", url: "http://x/v1.mp4", id: "1" }],
    pixabayVideo: async () => [{ type: "video", url: "http://x/v2.mp4", id: "2" }],
    pixabayPhoto: async () => { throw new Error("skip"); },
    unsplash: async () => [{ type: "image", url: "http://x/i.jpg", id: "u" }],
  };
  const out = await findMediaCandidates("q", ["pexelsVideo", "pixabayVideo", "pixabayPhoto", "unsplash"], providers);
  assert.strictEqual(out.length, 3);
  assert.deepStrictEqual(out[0], { type: "video", url: "http://x/v1.mp4", id: "1", provider: "pexelsVideo" });
  assert.strictEqual(out[2].provider, "unsplash");
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/lib/stock.test.js`
Expected: FAIL — `findMediaCandidates is not a function`.

- [ ] **Step 3: Implement** (append in `pipeline/lib/stock.js` before `module.exports`)

```js
// Returns a flat, ordered list of candidates across providers (best-effort).
async function findMediaCandidates(query, order, providers) {
  const out = [];
  for (const name of order) {
    const fn = providers[name];
    if (!fn) continue;
    try {
      const hits = await fn(query);
      for (const h of hits || []) {
        if (h && h.url) out.push({ ...h, provider: name });
      }
    } catch (_) { /* skip provider */ }
  }
  return out;
}
```

Update exports: `module.exports = { findMedia, findMediaCandidates };`

- [ ] **Step 4: Run to verify pass**

Run: `node --test pipeline/lib/stock.test.js`
Expected: PASS (original 3 + new 1).

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/stock.js pipeline/lib/stock.test.js
git commit -m "feat: findMediaCandidates pool across providers"
```

---

### Task 3: Seed helpers + pickMusic

**Files:**
- Create: `pipeline/lib/seed.js`
- Test: `pipeline/lib/seed.test.js`

- [ ] **Step 1: Write the failing test**

`pipeline/lib/seed.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const { hashSeed, seededInt, pickFrom, pickMusic } = require("./seed");

test("hashSeed is deterministic and non-negative", () => {
  assert.strictEqual(hashSeed("abc"), hashSeed("abc"));
  assert.ok(hashSeed("abc") >= 0);
  assert.notStrictEqual(hashSeed("abc"), hashSeed("abd"));
});

test("seededInt stays in range and is deterministic", () => {
  const v = seededInt("run-1", 4);
  assert.ok(v >= 0 && v < 4);
  assert.strictEqual(seededInt("run-1", 4), v);
  assert.strictEqual(seededInt("x", 0), 0);
});

test("pickFrom selects deterministically; pickMusic handles empty", () => {
  const arr = ["a", "b", "c"];
  assert.strictEqual(pickFrom("seedX", arr), pickFrom("seedX", arr));
  assert.ok(arr.includes(pickFrom("seedX", arr)));
  assert.strictEqual(pickMusic([], "s"), null);
  assert.strictEqual(pickMusic(["t1.mp3", "t2.mp3"], "s"), pickMusic(["t1.mp3", "t2.mp3"], "s"));
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/lib/seed.test.js`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`pipeline/lib/seed.js`
```js
function hashSeed(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededInt(seed, n) {
  if (!n || n <= 0) return 0;
  return hashSeed(seed) % n;
}
function pickFrom(seed, arr) {
  return arr[seededInt(seed, arr.length)];
}
function pickMusic(files, seed) {
  return files.length ? files[seededInt(seed, files.length)] : null;
}
module.exports = { hashSeed, seededInt, pickFrom, pickMusic };
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test pipeline/lib/seed.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/seed.js pipeline/lib/seed.test.js
git commit -m "feat: deterministic seed helpers + pickMusic"
```

---

### Task 4: config additions + .gitignore music

**Files:**
- Modify: `pipeline/config.js`
- Modify: `pipeline/config.test.js`
- Modify: `.gitignore`

- [ ] **Step 1: Update the failing test** (append to `pipeline/config.test.js` inside the existing test or add a new one)

```js
test("config has accentPalette, transitions, music", () => {
  assert.ok(Array.isArray(cfg.accentPalette) && cfg.accentPalette.length >= 3);
  assert.deepStrictEqual(cfg.transitions, ["slideLeft", "slideUp", "zoomIn", "fade"]);
  assert.strictEqual(cfg.music.dir, "remotion/public/music");
  assert.ok(cfg.music.volume > 0 && cfg.music.volume < 1);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/config.test.js`
Expected: FAIL — `cfg.accentPalette` undefined.

- [ ] **Step 3: Implement** — replace `pipeline/config.js` with:

```js
module.exports = {
  render: { width: 1080, height: 1920, fps: 30 },
  voice: "en-US-ChristopherNeural",
  ttsRate: "+8%",
  stockOrder: ["pexels", "pixabay", "unsplash"],
  model: "deepseek/deepseek-chat",
  theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@channel" },
  accentPalette: ["#FFD400", "#FF4D6D", "#33D6A6", "#4DA3FF", "#B26BFF"],
  transitions: ["slideLeft", "slideUp", "zoomIn", "fade"],
  // Video-first candidate order used by stage 05.
  mediaOrder: ["pexelsVideo", "pixabayVideo", "pixabayPhoto", "unsplash"],
  music: { dir: "remotion/public/music", volume: 0.1 },
};
```

In `.gitignore`, replace the line `remotion/public/*/` with these two lines so the music folder is tracked but per-run folders are not:
```
remotion/public/*/
!remotion/public/music/
```
And add below the `*.mp3` line an exception for committed music:
```
!remotion/public/music/*.mp3
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test pipeline/config.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/config.js pipeline/config.test.js .gitignore
git commit -m "feat: config palette/transitions/music + track music dir"
```

---

### Task 5: buildInputProps — seeded accent, per-scene transition, music

**Files:**
- Modify: `pipeline/lib/timeline.js`
- Modify: `pipeline/lib/timeline.test.js`

- [ ] **Step 1: Update the failing test** — replace the `buildInputProps` test in `pipeline/lib/timeline.test.js` with:

```js
test("buildInputProps converts frames, seeds accent + transition, wires music", () => {
  const scenesDoc = { scenes: [
    { id: 1, on_screen_text: "A", duration_sec: 2.0 },
    { id: 2, on_screen_text: null, duration_sec: 1.0 },
  ]};
  const media = [ { sceneId: 1, type: "video", file: "scene_01.mp4" },
                  { sceneId: 2, type: "image", file: "scene_02.jpg" } ];
  const transitions = ["slideLeft", "slideUp", "zoomIn", "fade"];
  const accentPalette = ["#111111", "#222222", "#333333"];
  const props = buildInputProps({
    runId: "r1", scenesDoc, media,
    captions: [{ text: "hi", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 }],
    theme: { accentColor: "#000000", fontFamily: "Anton", channelName: "@c" },
    fps: 30, seed: "r1", accentPalette, transitions, musicSrc: "r1/music.mp3", musicVolume: 0.1,
  });
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.strictEqual(props.scenes[1].startFrame, 60);
  assert.strictEqual(props.scenes[0].media.src, "r1/scene_01.mp4");
  assert.strictEqual(props.audioSrc, "r1/voiceover.mp3");
  assert.strictEqual(props.musicSrc, "r1/music.mp3");
  assert.strictEqual(props.musicVolume, 0.1);
  assert.ok(accentPalette.includes(props.theme.accentColor)); // seeded override
  assert.ok(transitions.includes(props.scenes[0].transition));
  assert.strictEqual(props.scenes[0].transition, props.scenes[0].transition); // deterministic
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/lib/timeline.test.js`
Expected: FAIL — accent not overridden / `transition` undefined.

- [ ] **Step 3: Implement** — in `pipeline/lib/timeline.js`, add the require at top and replace `buildInputProps`:

At the very top of the file:
```js
const { pickFrom } = require("./seed");
```

Replace the whole `buildInputProps` function with:
```js
function buildInputProps({ runId, scenesDoc, media, captions, theme, fps, seed, accentPalette, transitions, musicSrc, musicVolume }) {
  const byId = new Map(media.map((m) => [m.sceneId, m]));
  const accentColor = pickFrom(seed, accentPalette);
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
      transition: pickFrom(`${seed}:${s.id}`, transitions),
    };
    frame += durationFrames;
    return node;
  });
  return {
    fps, width: 1080, height: 1920,
    audioSrc: `${runId}/voiceover.mp3`,
    musicSrc: musicSrc || null,
    musicVolume,
    theme: { ...theme, accentColor },
    captions, scenes,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test pipeline/lib/timeline.test.js`
Expected: PASS (applyTimings + assembleCaptions + new buildInputProps).

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/timeline.js pipeline/lib/timeline.test.js
git commit -m "feat: buildInputProps seeds accent/transition + music"
```

---

### Task 6: 02-script — distinct queries + alt fallback

**Files:**
- Modify: `pipeline/02-script.js`
- Modify: `pipeline/02-script.test.js`

- [ ] **Step 1: Update the test** — in `pipeline/02-script.test.js`, change the fake chat scene to include `visual_query_alt`, and assert it persists. Replace the `scenes` array in the fake and add an assertion:

In the `fakeChat` return, change the scenes entry to:
```js
    scenes: [{ id: 1, narration: "Octopuses have three hearts.", visual_query: "octopus closeup", visual_query_alt: "deep ocean", on_screen_text: "3 HEARTS" }],
```
Add after the existing `scenes.scenes[0].visual_query` assertion:
```js
  assert.strictEqual(scenes.scenes[0].visual_query, "octopus closeup");
  assert.strictEqual(scenes.scenes[0].visual_query_alt, "deep ocean");
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/02-script.test.js`
Expected: FAIL — `visual_query_alt` is undefined on persisted scene.

- [ ] **Step 3: Implement** — in `pipeline/02-script.js`:

Replace the `SYSTEM` string with:
```js
const SYSTEM = `You are a YouTube Shorts scriptwriter. Write a 40-50 second English voiceover, 3-6 scenes.
Rules: 2nd person, short punchy sentences, a strong hook in scene 1, numbers spelled where it helps TTS.
Respond ONLY JSON: {hook, cta, scenes:[{id, narration, visual_query, visual_query_alt, on_screen_text}], title, description, tags}.
Each scene's visual_query MUST be DISTINCT from the others and specific (2-4 English words describing a concrete, filmable shot, e.g. "octopus tentacles macro", not just "octopus"). visual_query_alt is a different backup query for the same scene. on_screen_text = short punchy caption or null. title <= 90 chars ending with " #shorts". tags = 10-20 strings including "shorts".`;
```

In the `scenes.map`, add `visual_query_alt`:
```js
    scenes: out.scenes.map((s) => ({
      id: s.id, narration: s.narration,
      visual_query: s.visual_query,
      visual_query_alt: s.visual_query_alt || null,
      on_screen_text: s.on_screen_text || null,
      duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0,
    })),
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test pipeline/02-script.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/02-script.js pipeline/02-script.test.js
git commit -m "feat: distinct visual queries + alt fallback (stage 02)"
```

---

### Task 7: 05-media — candidate pool + dedup + video-first + alt

**Files:**
- Modify: `pipeline/05-media.js`
- Modify: `pipeline/05-media.test.js`

- [ ] **Step 1: Replace the test** in `pipeline/05-media.test.js` with:

```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { fetchSceneMedia } = require("./05-media");

test("fetchSceneMedia dedups within a run and falls back to alt query", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "media-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "r1", "scenes.json"), JSON.stringify({
    scenes: [
      { id: 1, visual_query: "octopus", visual_query_alt: "ocean", duration_sec: 2 },
      { id: 2, visual_query: "octopus", visual_query_alt: "coral", duration_sec: 2 },
    ],
  }));
  // Both scenes' primary query returns the SAME single candidate -> scene 2 must use its alt.
  const find = async (q) => {
    if (q === "octopus") return [{ type: "video", url: "http://x/same.mp4", id: "1", provider: "pexelsVideo" }];
    if (q === "coral") return [{ type: "image", url: "http://x/coral.jpg", id: "9", provider: "unsplash" }];
    return [];
  };
  const downloaded = [];
  const download = async (url, dest) => { downloaded.push(url); fs.writeFileSync(dest, "bin"); };
  const media = await fetchSceneMedia({ runId: "r1", runRoot, pubRoot, find, download });
  assert.strictEqual(media[0].file, "scene_01.mp4");
  assert.strictEqual(media[1].type, "image");
  assert.strictEqual(media[1].file, "scene_02.jpg");
  assert.deepStrictEqual(downloaded, ["http://x/same.mp4", "http://x/coral.jpg"]);
  const written = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "media.json"), "utf8"));
  assert.strictEqual(written.length, 2);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/05-media.test.js`
Expected: FAIL (current impl uses single `find` returning one hit, no dedup/alt).

- [ ] **Step 3: Implement** — replace `pipeline/05-media.js` with:

```js
const fs = require("node:fs");
const path = require("node:path");
const { readJSON, writeJSON, runPath } = require("./lib/fsx");

function keyOf(c) { return `${c.provider}:${c.id || c.url}`; }

// find(query) -> Promise<candidate[]> where candidate = { type, url, id, provider }
async function fetchSceneMedia({ runId, runRoot, pubRoot, find, download }) {
  const doc = readJSON(runPath(runRoot, runId, "scenes.json"));
  const destDir = path.join(pubRoot, runId);
  fs.mkdirSync(destDir, { recursive: true });

  const used = new Set();
  const media = [];
  for (const s of doc.scenes) {
    let cands = await find(s.visual_query);
    let pick = cands.find((c) => !used.has(keyOf(c)));
    if (!pick && s.visual_query_alt) {
      cands = await find(s.visual_query_alt);
      pick = cands.find((c) => !used.has(keyOf(c)));
    }
    if (!pick) pick = cands[0]; // last resort: allow a repeat
    if (!pick) throw new Error(`no stock media for scene ${s.id} ("${s.visual_query}")`);
    used.add(keyOf(pick));
    const ext = pick.type === "video" ? "mp4" : "jpg";
    const file = `scene_${String(s.id).padStart(2, "0")}.${ext}`;
    await download(pick.url, path.join(destDir, file));
    media.push({ sceneId: s.id, type: pick.type, file, provider: pick.provider });
  }
  writeJSON(runPath(runRoot, runId, "media.json"), media);
  return media;
}
module.exports = { fetchSceneMedia };

if (require.main === module) {
  const cfg = require("./config");
  const { findMediaCandidates } = require("./lib/stock");
  const providers = require("./lib/providers");
  const { download } = require("./lib/download");
  const provFns = {
    pexelsVideo: (q) => providers.pexelsVideoCandidates(q, { apiKey: process.env.PEXELS_API_KEY }),
    pixabayVideo: (q) => providers.pixabayVideoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
    pixabayPhoto: (q) => providers.pixabayPhotoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
    unsplash: (q) => providers.unsplashCandidates(q, { apiKey: process.env.UNSPLASH_API_KEY }),
  };
  const find = (q) => findMediaCandidates(q, cfg.mediaOrder, provFns);
  fetchSceneMedia({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", pubRoot: "remotion/public", find, download })
    .then((m) => console.log("media:", m.length));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test pipeline/05-media.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/05-media.js pipeline/05-media.test.js
git commit -m "feat: stage 05 candidate pool + run dedup + video-first + alt"
```

---

### Task 8: run.js — wire candidate providers for media

**Files:**
- Modify: `pipeline/run.js`

- [ ] **Step 1: Update the media wiring** — in `pipeline/run.js`, replace the `provFns`/`find` block (the one building `pexels/pixabay/unsplash` and `findMedia`) with:

```js
  const { findMediaCandidates } = require("./lib/stock");
  const provFns = {
    pexelsVideo: (q) => providers.pexelsVideoCandidates(q, { apiKey: process.env.PEXELS_API_KEY }),
    pixabayVideo: (q) => providers.pixabayVideoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
    pixabayPhoto: (q) => providers.pixabayPhotoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
    unsplash: (q) => providers.unsplashCandidates(q, { apiKey: process.env.UNSPLASH_API_KEY }),
  };
  const find = (q) => findMediaCandidates(q, cfg.mediaOrder, provFns);
  await fetchSceneMedia({ runId, runRoot, pubRoot: "remotion/public", find, download });
```

Also remove the now-unused top `const { findMedia } = require("./lib/stock");` import line (if present) to avoid a dead import.

- [ ] **Step 2: Smoke-check the module loads**

Run: `node -e "require('./pipeline/run.js'); console.log('OK')"`
Expected: `OK` (no throw; `main()` is not called on require).

- [ ] **Step 3: Run the full suite**

Run: `node --test "pipeline/**/*.test.js"`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add pipeline/run.js
git commit -m "feat: run.js wires candidate-pool media providers"
```

---

### Task 9: 06-render — select music + pass seed/palette/transitions

**Files:**
- Modify: `pipeline/06-render.js`
- Modify: `pipeline/06-render.test.js`

- [ ] **Step 1: Replace the test** in `pipeline/06-render.test.js` with:

```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { prepareRender } = require("./06-render");

function seedRun(runRoot, pubRoot) {
  const dir = path.join(runRoot, "r1"); fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.mkdirSync(path.join(pubRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(dir, "audio", "voiceover.mp3"), "AUDIO");
  fs.writeFileSync(path.join(dir, "scenes.json"), JSON.stringify({ scenes: [{ id: 1, on_screen_text: "A", duration_sec: 2.0 }], total_duration_sec: 2.0 }));
  fs.writeFileSync(path.join(dir, "media.json"), JSON.stringify([{ sceneId: 1, type: "video", file: "scene_01.mp4" }]));
  fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify([{ text: "hi", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 }]));
}
const baseArgs = (runRoot, pubRoot, musicDir) => ({
  runId: "r1", runRoot, pubRoot,
  theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@c" },
  fps: 30, seed: "r1", accentPalette: ["#111", "#222"], transitions: ["slideLeft", "fade"],
  musicDir, musicVolume: 0.1,
});

test("prepareRender copies audio, builds props, no music when dir empty/missing", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rnd-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpub-"));
  seedRun(runRoot, pubRoot);
  const props = prepareRender(baseArgs(runRoot, pubRoot, path.join(runRoot, "no-music")));
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.strictEqual(props.audioSrc, "r1/voiceover.mp3");
  assert.strictEqual(props.musicSrc, null);
  assert.strictEqual(fs.readFileSync(path.join(pubRoot, "r1", "voiceover.mp3"), "utf8"), "AUDIO");
});

test("prepareRender selects + copies a music track when present", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rnd-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpub-"));
  seedRun(runRoot, pubRoot);
  const musicDir = path.join(runRoot, "music"); fs.mkdirSync(musicDir, { recursive: true });
  fs.writeFileSync(path.join(musicDir, "a.mp3"), "MUSICA");
  fs.writeFileSync(path.join(musicDir, "b.mp3"), "MUSICB");
  const props = prepareRender(baseArgs(runRoot, pubRoot, musicDir));
  assert.strictEqual(props.musicSrc, "r1/music.mp3");
  assert.ok(fs.existsSync(path.join(pubRoot, "r1", "music.mp3")));
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test pipeline/06-render.test.js`
Expected: FAIL (prepareRender signature lacks seed/music handling).

- [ ] **Step 3: Implement** — replace `pipeline/06-render.js` with:

```js
const fs = require("node:fs");
const path = require("node:path");
const { readJSON, runPath } = require("./lib/fsx");
const { buildInputProps } = require("./lib/timeline");
const { pickMusic } = require("./lib/seed");

function prepareRender({ runId, runRoot, pubRoot, theme, fps, seed, accentPalette, transitions, musicDir, musicVolume }) {
  const scenesDoc = readJSON(runPath(runRoot, runId, "scenes.json"));
  const media = readJSON(runPath(runRoot, runId, "media.json"));
  const captions = readJSON(runPath(runRoot, runId, "captions.json"));

  const destBase = path.join(pubRoot, runId);
  fs.mkdirSync(destBase, { recursive: true });

  // audio: run/<id>/audio/voiceover.mp3 -> public/<id>/voiceover.mp3
  fs.copyFileSync(runPath(runRoot, runId, "audio", "voiceover.mp3"), path.join(destBase, "voiceover.mp3"));

  // music: optional, seeded pick from musicDir
  let musicSrc = null;
  try {
    if (musicDir && fs.existsSync(musicDir)) {
      const files = fs.readdirSync(musicDir).filter((f) => f.toLowerCase().endsWith(".mp3"));
      const pick = pickMusic(files, seed);
      if (pick) {
        fs.copyFileSync(path.join(musicDir, pick), path.join(destBase, "music.mp3"));
        musicSrc = `${runId}/music.mp3`;
      }
    }
  } catch (_) { /* music is best-effort */ }

  return buildInputProps({ runId, scenesDoc, media, captions, theme, fps, seed, accentPalette, transitions, musicSrc, musicVolume });
}

async function render({ runId, runRoot, pubRoot, theme, fps, outFile }) {
  const cfg = require("./config");
  const inputProps = prepareRender({
    runId, runRoot, pubRoot, theme, fps,
    seed: runId, accentPalette: cfg.accentPalette, transitions: cfg.transitions,
    musicDir: cfg.music.dir, musicVolume: cfg.music.volume,
  });
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

- [ ] **Step 4: Run to verify pass + full suite**

Run: `node --test pipeline/06-render.test.js`
Expected: PASS (2 tests).
Run: `node --test "pipeline/**/*.test.js"`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/06-render.js pipeline/06-render.test.js
git commit -m "feat: stage 06 seeded props + optional background music"
```

---

## Phase B — Remotion: kinetic animation layer

> All `remotion/` work is verified by `anim.test.ts` (CI `npm test`) + the throwaway-Node math check; full type-check + render happen in CI (Termux FAT blocks `npm install`).

### Task 10: anim.ts — pop/punch/stagger/transition helpers

**Files:**
- Modify: `remotion/src/lib/anim.ts`
- Modify: `remotion/src/lib/anim.test.ts`

- [ ] **Step 1: Add failing tests** (append to `remotion/src/lib/anim.test.ts`)

```ts
import { popScale, punchZoom, staggerReveal, transitionStyle } from "./anim";

test("popScale overshoots then settles to 1", () => {
  assert.ok(Math.abs(popScale(0) - 0.6) < 1e-9);
  assert.ok(popScale(0.7) > 1.1);
  assert.ok(Math.abs(popScale(1) - 1) < 1e-9);
});

test("punchZoom goes 1.12 -> 1.0", () => {
  assert.ok(Math.abs(punchZoom(0) - 1.12) < 1e-9);
  assert.ok(Math.abs(punchZoom(1) - 1.0) < 1e-9);
});

test("staggerReveal gives per-index 0..1 progress", () => {
  assert.strictEqual(staggerReveal(0, 0, 30, 6), 0);
  assert.strictEqual(staggerReveal(0, 6, 30, 6), 1);
  assert.strictEqual(staggerReveal(2, 6, 30, 6), 0); // word 2 not started yet at frame 6
});

test("transitionStyle maps variants to numeric transforms", () => {
  assert.deepStrictEqual(transitionStyle("slideLeft", 0), { x: 100, y: 0, scale: 1, opacity: 1 });
  assert.deepStrictEqual(transitionStyle("slideLeft", 1), { x: 0, y: 0, scale: 1, opacity: 1 });
  assert.deepStrictEqual(transitionStyle("slideUp", 0), { x: 0, y: 100, scale: 1, opacity: 1 });
  assert.strictEqual(transitionStyle("zoomIn", 0).scale, 0.8);
  assert.strictEqual(transitionStyle("fade", 0).opacity, 0);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd remotion && npm test` (or, if remotion can't install locally, write `~/anim_check.cjs` mirroring the new fns and run `node ~/anim_check.cjs`).
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement** — append to `remotion/src/lib/anim.ts`:

```ts
function clamp01(x: number): number { return Math.min(Math.max(x, 0), 1); }

// p in 0..1 -> scale that rises to ~1.2 overshoot at p=0.7 then settles to 1.0
export function popScale(p: number): number {
  const t = clamp01(p);
  if (t <= 0.7) return 0.6 + (1.2 - 0.6) * (t / 0.7);
  return 1.2 - 0.2 * ((t - 0.7) / 0.3);
}

// p in 0..1 -> scale from 1.12 down to 1.0
export function punchZoom(p: number): number {
  return 1.0 + 0.12 * (1 - clamp01(p));
}

// progress (0..1) of word `index` given the current frame
export function staggerReveal(index: number, frame: number, fps: number, perItemFrames: number): number {
  return clamp01((frame - index * perItemFrames) / perItemFrames);
}

export type TransitionTransform = { x: number; y: number; scale: number; opacity: number };
// p in 0..1 -> entrance transform. x/y are percentages.
export function transitionStyle(variant: string, p: number): TransitionTransform {
  const t = clamp01(p);
  switch (variant) {
    case "slideLeft": return { x: (1 - t) * 100, y: 0, scale: 1, opacity: 1 };
    case "slideUp": return { x: 0, y: (1 - t) * 100, scale: 1, opacity: 1 };
    case "zoomIn": return { x: 0, y: 0, scale: 0.8 + 0.2 * t, opacity: 1 };
    case "fade":
    default: return { x: 0, y: 0, scale: 1, opacity: t };
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd remotion && npm test` (CI) or `node ~/anim_check.cjs && echo MATH_OK`.
Expected: PASS / MATH_OK. Delete the throwaway afterwards.

- [ ] **Step 5: Commit**

```bash
git add remotion/src/lib/anim.ts remotion/src/lib/anim.test.ts
git commit -m "feat: kinetic anim helpers (pop/punch/stagger/transition)"
```

---

### Task 11: schema.ts — music + transition fields

**Files:**
- Modify: `remotion/src/schema.ts`

- [ ] **Step 1: Implement** — in `remotion/src/schema.ts`:

Add `transition` to `sceneSchema`:
```ts
export const sceneSchema = z.object({
  id: z.number(),
  onScreenText: z.string().nullable(),
  startFrame: z.number(),
  durationFrames: z.number(),
  media: z.object({ type: z.enum(["video", "image"]), src: z.string() }),
  transition: z.string(),
});
```

Add `musicSrc` + `musicVolume` to `shortSchema`:
```ts
export const shortSchema = z.object({
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  audioSrc: z.string(),
  musicSrc: z.string().nullable(),
  musicVolume: z.number(),
  theme: themeSchema,
  captions: z.array(captionSchema),
  scenes: z.array(sceneSchema),
});
```

- [ ] **Step 2: Type-check (CI) / structural check (local)**

Run (local): `node -e "const s=require('node:fs').readFileSync('remotion/src/schema.ts','utf8'); if(!/musicSrc/.test(s)||!/transition: z.string/.test(s)) throw new Error('missing fields'); console.log('SCHEMA_OK')"`
Expected: `SCHEMA_OK`. (Full `tsc` runs in CI.)

- [ ] **Step 3: Commit**

```bash
git add remotion/src/schema.ts
git commit -m "feat: schema adds music + scene transition"
```

---

### Task 12: KineticCaptions component

**Files:**
- Create: `remotion/src/components/KineticCaptions.tsx`

- [ ] **Step 1: Implement**

`remotion/src/components/KineticCaptions.tsx`
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { activeCaptionIndex, popScale } from "../lib/anim";
import type { CaptionItem } from "../schema";

const WINDOW = 4;
const POP_MS = 180;

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
  const activeScale = popScale(popP);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 380 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, maxWidth: "88%", textAlign: "center" }}>
        {win.map((c, i) => {
          const idx = start + i;
          const isActive = idx === active;
          return (
            <span
              key={idx}
              style={{
                position: "relative",
                fontFamily, fontWeight: 800, lineHeight: 1.05,
                fontSize: isActive ? 80 : 64,
                color: isActive ? "#000" : "white",
                opacity: isActive ? 1 : 0.55,
                transform: `scale(${isActive ? activeScale : 0.9}) translateY(${isActive ? -8 : 0}px)`,
                background: isActive ? accentColor : "transparent",
                padding: isActive ? "2px 16px" : "0",
                borderRadius: 12,
                WebkitTextStroke: isActive ? "0px" : "3px black",
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

- [ ] **Step 2: Structural check** (CI does the real type-check)

Run: `node -e "const s=require('node:fs').readFileSync('remotion/src/components/KineticCaptions.tsx','utf8'); if(!/popScale/.test(s)) throw new Error('x'); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/components/KineticCaptions.tsx
git commit -m "feat: kinetic word-pop captions"
```

---

### Task 13: TitleCard component

**Files:**
- Create: `remotion/src/components/TitleCard.tsx`

- [ ] **Step 1: Implement**

`remotion/src/components/TitleCard.tsx`
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { popScale, staggerReveal } from "../lib/anim";

// Word-by-word reveal of the hook, shown briefly at the start of scene 1.
export const TitleCard: React.FC<{ text: string; fontFamily: string; accentColor: string; holdFrames: number }> = ({
  text, fontFamily, accentColor, holdFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const fadeOut = interpolate(frame, [holdFrames, holdFrames + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60, opacity: fadeOut }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
        {words.map((w, i) => {
          const p = staggerReveal(i, frame, fps, 4);
          return (
            <span
              key={i}
              style={{
                fontFamily, fontWeight: 800, fontSize: 104, lineHeight: 1.0,
                color: i % 2 === 0 ? "white" : accentColor,
                transform: `scale(${popScale(p)})`,
                opacity: p === 0 ? 0 : 1,
                WebkitTextStroke: "4px black", paintOrder: "stroke fill",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Structural check**

Run: `node -e "require('node:fs').readFileSync('remotion/src/components/TitleCard.tsx','utf8').includes('staggerReveal')||process.exit(1);console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/components/TitleCard.tsx
git commit -m "feat: animated hook title card"
```

---

### Task 14: MotionBackground component

**Files:**
- Create: `remotion/src/components/MotionBackground.tsx`

- [ ] **Step 1: Implement**

`remotion/src/components/MotionBackground.tsx`
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

// Floating accent shapes + drifting vignette to keep static-photo scenes alive.
export const MotionBackground: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 40]);
  const spin = interpolate(frame, [0, durationInFrames], [0, 25]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute", top: `${10 + drift * 0.2}%`, left: "-10%",
        width: 360, height: 360, borderRadius: "50%",
        border: `10px solid ${accentColor}`, opacity: 0.25,
        transform: `rotate(${spin}deg)`,
      }} />
      <div style={{
        position: "absolute", bottom: `${8 + drift * 0.15}%`, right: "-8%",
        width: 280, height: 280, background: accentColor, opacity: 0.18,
        transform: `rotate(${-spin}deg)`,
      }} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)" }} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Structural check**

Run: `node -e "require('node:fs').readFileSync('remotion/src/components/MotionBackground.tsx','utf8').includes('MotionBackground')||process.exit(1);console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/components/MotionBackground.tsx
git commit -m "feat: motion-graphics background for photo scenes"
```

---

### Task 15: Scene — entrance + zoom-punch + photo background

**Files:**
- Modify: `remotion/src/components/Scene.tsx`

- [ ] **Step 1: Implement** — replace `remotion/src/components/Scene.tsx` with:

```tsx
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { kenBurnsScale, punchZoom, transitionStyle } from "../lib/anim";
import { MotionBackground } from "./MotionBackground";
import type { SceneNode } from "../schema";

const ENTRANCE_FRAMES = 8;
const PUNCH_FRAMES = 12;

export const Scene: React.FC<{ scene: SceneNode; accentColor: string }> = ({ scene, accentColor }) => {
  const frame = useCurrentFrame(); // Sequence-relative
  const ts = transitionStyle(scene.transition, Math.min(frame / ENTRANCE_FRAMES, 1));
  const punch = punchZoom(Math.min(frame / PUNCH_FRAMES, 1));
  const kb = kenBurnsScale(frame, scene.durationFrames);
  const isImage = scene.media.type === "image";
  const scale = ts.scale * punch * kb;
  const src = staticFile(scene.media.src);

  return (
    <AbsoluteFill style={{ opacity: ts.opacity, backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `translate(${ts.x}%, ${ts.y}%) scale(${scale})` }}>
        {scene.media.type === "video" ? (
          <Video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
        ) : (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </AbsoluteFill>
      {isImage ? <MotionBackground accentColor={accentColor} /> : null}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.85) 100%)" }} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Structural check**

Run: `node -e "const s=require('node:fs').readFileSync('remotion/src/components/Scene.tsx','utf8'); ['transitionStyle','punchZoom','MotionBackground','accentColor'].forEach(k=>{if(!s.includes(k))throw new Error(k)}); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add remotion/src/components/Scene.tsx
git commit -m "feat: scene entrance + zoom-punch + photo motion bg"
```

---

### Task 16: ProgressBar — stylized

**Files:**
- Modify: `remotion/src/components/ProgressBar.tsx`

- [ ] **Step 1: Implement** — replace `remotion/src/components/ProgressBar.tsx` with:

```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const ProgressBar: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const width = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ height: 12, width: `${width}%`, background: accentColor, boxShadow: `0 0 18px ${accentColor}` }} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add remotion/src/components/ProgressBar.tsx
git commit -m "feat: bolder glowing progress bar"
```

---

### Task 17: Short + Root — wire accent, music, kinetic captions, title

**Files:**
- Modify: `remotion/src/Short.tsx`
- Modify: `remotion/src/Root.tsx`

- [ ] **Step 1: Implement Short.tsx** — replace `remotion/src/Short.tsx` with:

```tsx
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig, interpolate } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Anton";
import { Scene } from "./components/Scene";
import { OnScreenText } from "./components/OnScreenText";
import { KineticCaptions } from "./components/KineticCaptions";
import { TitleCard } from "./components/TitleCard";
import { ProgressBar } from "./components/ProgressBar";
import type { ShortProps } from "./schema";

const { fontFamily } = loadFont();

const Music: React.FC<{ src: string; volume: number }> = ({ src, volume }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={staticFile(src)}
      loop
      volume={(f) =>
        interpolate(f, [0, 15, durationInFrames - 15, durationInFrames], [0, volume, volume, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        })
      }
    />
  );
};

export const Short: React.FC<ShortProps> = ({ audioSrc, musicSrc, musicVolume, theme, captions, scenes }) => {
  const ff = theme.fontFamily === "Anton" ? fontFamily : theme.fontFamily;
  const accent = theme.accentColor;
  const hookText = scenes[0]?.onScreenText || "";
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={staticFile(audioSrc)} />
      {musicSrc ? <Music src={musicSrc} volume={musicVolume} /> : null}
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationFrames}>
          <Scene scene={scene} accentColor={accent} />
          {scene.onScreenText ? (
            <OnScreenText text={scene.onScreenText} fontFamily={ff} accentColor={accent} />
          ) : null}
        </Sequence>
      ))}
      {scenes[0] && hookText ? (
        <Sequence from={scenes[0].startFrame} durationInFrames={Math.min(scenes[0].durationFrames, 45)}>
          <TitleCard text={hookText} fontFamily={ff} accentColor={accent} holdFrames={30} />
        </Sequence>
      ) : null}
      <KineticCaptions captions={captions} fontFamily={ff} accentColor={accent} />
      <ProgressBar accentColor={accent} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Implement Root.tsx** — replace the `defaultProps` object in `remotion/src/Root.tsx` with:

```tsx
const defaultProps: ShortProps = {
  fps: 30, width: 1080, height: 1920,
  audioSrc: "", musicSrc: null, musicVolume: 0.1,
  theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@channel" },
  captions: [], scenes: [],
};
```

(The `calculateMetadata` and `Composition` stay unchanged — duration is still `Σ durationFrames`.)

- [ ] **Step 3: Structural check**

Run: `node -e "const s=require('node:fs').readFileSync('remotion/src/Short.tsx','utf8'); ['KineticCaptions','TitleCard','@remotion/media','musicSrc'].forEach(k=>{if(!s.includes(k))throw new Error(k)}); const r=require('node:fs').readFileSync('remotion/src/Root.tsx','utf8'); if(!r.includes('musicSrc'))throw new Error('root'); console.log('OK')"`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add remotion/src/Short.tsx remotion/src/Root.tsx
git commit -m "feat: Short wires accent/music/kinetic captions/title card"
```

---

## Phase C — Music assets + final verification

### Task 18: music folder + docs

**Files:**
- Create: `remotion/public/music/README.md`
- Modify: `README.md`

- [ ] **Step 1: Create the music folder doc**

`remotion/public/music/README.md`
```markdown
# Background music

Drop royalty-free `.mp3` tracks here (you must have the rights to use them).
The pipeline picks one per video (seeded by run id), plays it under the voiceover
at low volume with a fade in/out. If this folder has no `.mp3`, videos render
without music. `.mp3` files in this folder ARE committed (see `.gitignore`).
```

- [ ] **Step 2: Note it in README** — append to `README.md`:
```markdown

## Background music
Add royalty-free `.mp3` files to `remotion/public/music/` (committed). One is chosen per video automatically; empty folder = no music.
```

- [ ] **Step 3: Commit**

```bash
git add remotion/public/music/README.md README.md
git commit -m "docs: background music folder"
```

---

### Task 19: full suite + final verification

- [ ] **Step 1: Run the entire pipeline test suite**

Run: `node --test "pipeline/**/*.test.js"`
Expected: ALL pass (providers, stock, seed, config, timeline, 01, 02, 03, 05, 06, run).

- [ ] **Step 2: Verify anim math locally** (remotion can't install on Termux)

Write a throwaway `~/anim_check.cjs` mirroring `popScale`/`punchZoom`/`staggerReveal`/`transitionStyle` and assert the Task 10 expectations, then `node ~/anim_check.cjs && echo MATH_OK && rm ~/anim_check.cjs`.
Expected: `MATH_OK`.

- [ ] **Step 3: Commit any test-only fixups, then push for CI render**

```bash
git status   # should be clean if no fixups
```

(The real type-check + render happen in CI via `produce.yml`.)

---

## Self-Review

**Spec coverage:** §2.1 dedup → Tasks 1,2,7. §2.2 distinct queries+alt → Task 6 (+7 uses alt). §2.3 video-first mix → Tasks 1,4,7 (`mediaOrder`). §2.4 seeded variety → Tasks 3,5. §3.1 kinetic captions → Tasks 10,12. §3.2 transitions → Tasks 10,15 (entrance, not TransitionSeries — see Key decisions). §3.3 zoom-punch → Tasks 10,15. §3.4 title card → Tasks 10,13,17. §3.5 motion bg → Tasks 14,15. §3.6 progress/channel → Task 16 (channel tag already in OnScreenText/footer; progress done). §3.7 helpers → Task 10. §4 music → Tasks 3,4,9,17,18. All covered.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `buildInputProps` params (seed/accentPalette/transitions/musicSrc/musicVolume) match `prepareRender` call (Task 9) and the timeline test (Task 5). `mediaOrder` names (`pexelsVideo|pixabayVideo|pixabayPhoto|unsplash`) match provider fns (Task 1), `provFns` keys (Tasks 7,8), and `findMediaCandidates` order. `transition` field added in schema (Task 11) is produced by `buildInputProps` (Task 5) and consumed by `Scene`/`transitionStyle` (Tasks 10,15). `musicSrc/musicVolume` flow: config (4) → render (9) → buildInputProps (5) → schema (11) → Short (17). Consistent.
```
