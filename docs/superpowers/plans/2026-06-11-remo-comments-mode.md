# remo Funny-Comments (AskReddit) Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second content mode — AskReddit "question + funniest comments" Shorts — that reuses the existing TTS/captions/render/upload infra but swaps the content source (Reddit + YouTube comments → LLM-curated deck), the Remotion composition (comment cards over background footage), and the target YouTube channel.

**Architecture:** A `mode` config (`facts`|`comments`) routes `run.js` to the right content stages, render composition, and channel token. New pipeline stages fetch + curate comments into `deck.json`; a shared `synthSegments` voiceover core serves both modes; a new `Comments` Remotion composition renders question/comment cards. Pure logic (reddit/yt parse, segment timing, upvote parse, curation parse) is `node:test`-unit-tested; render verified in CI.

**Tech Stack:** Node 20 CommonJS + `node:test`, Remotion 4.x (`@remotion/media`), Zod, ffmpeg, edge-tts, OpenRouter, Reddit public JSON, YouTube Data API. No new npm dependency.

---

## Data contracts (locked)

`run/<id>/deck.json` (after curate):
```json
{ "subreddit": "AskReddit",
  "question": "What's a small thing that instantly makes someone more likable?",
  "comments": [ { "id": 1, "author": "u/name", "text": "...", "upvotes": "12.4k" } ] }
```
`run/<id>/meta.json`: `{ title, description, tags, category_id }` (same shape as facts).

Voiceover segment (shared): `{ id, narration }`. After `synthSegments`: per-segment `duration_sec`/`audio_start_ms` + global `captions.json`.

Comments `inputProps` (built by `buildCommentsProps`):
```json
{ "fps":30,"width":1080,"height":1920,
  "audioSrc":"<id>/voiceover.mp3","musicSrc":"<id>/music.mp3|null","musicVolume":0.1,"sfxSrc":"<id>/sfx.mp3|null",
  "backgroundSrc":"<id>/bg.mp4","subreddit":"AskReddit","question":"…",
  "theme":{"accentColor":"…","fontFamily":"Anton","channelName":"@handle"},
  "captions":[…],
  "segments":[ { "kind":"question|comment","author":"u/x|null","upvotes":"12.4k|null","text":"…","startFrame":0,"durationFrames":90 } ] }
```

---

# PHASE 1 — Content pipeline (deck + shared voiceover)

### Task 1: config — mode + comments settings

**Files:** Modify `pipeline/config.js`, `pipeline/config.test.js`

- [ ] **Step 1: Append test**
```js
test("config has mode + comments settings", () => {
  assert.strictEqual(cfg.mode, "facts");
  assert.ok(Array.isArray(cfg.subreddits) && cfg.subreddits.length >= 1);
  assert.strictEqual(cfg.gameplay.dir, "remotion/public/gameplay");
  assert.strictEqual(cfg.commentsTokenEnv, "YT_COMMENTS_REFRESH_TOKEN");
});
```

- [ ] **Step 2: Run** `node --test pipeline/config.test.js` → FAIL.

- [ ] **Step 3: Implement** — add these keys to the `pipeline/config.js` exported object (after `visionModel`):
```js
  mode: process.env.MODE || "facts",
  subreddits: ["AskReddit", "Showerthoughts", "AskReddit", "tifu"],
  gameplay: { dir: "remotion/public/gameplay" },
  commentsTokenEnv: "YT_COMMENTS_REFRESH_TOKEN",
```

- [ ] **Step 4: Run** → PASS. Then `node --test "pipeline/**/*.test.js"` → all PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/config.js pipeline/config.test.js
git commit -m "feat: config mode + comments settings"
```

---

### Task 2: reddit.js — parse + fetch

**Files:** Create `pipeline/lib/reddit.js`, `pipeline/lib/reddit.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const { parseListing, parseComments, fetchTopPost } = require("./reddit");

test("parseListing keeps SFW question-like posts", () => {
  const json = { data: { children: [
    { data: { id: "a1", title: "What's the funniest thing?", over_18: false, stickied: false, num_comments: 500 } },
    { data: { id: "a2", title: "NSFW story", over_18: true, stickied: false, num_comments: 999 } },
    { data: { id: "a3", title: "Just a statement", over_18: false, stickied: false, num_comments: 10 } },
  ] } };
  const posts = parseListing(json);
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].id, "a1");
  assert.strictEqual(posts[0].title, "What's the funniest thing?");
});

test("parseComments extracts top-level bodies with author + score", () => {
  const json = [ {}, { data: { children: [
    { kind: "t1", data: { body: "lol great", author: "bob", score: 1234 } },
    { kind: "t1", data: { body: "[deleted]", author: "x", score: 5 } },
    { kind: "more", data: {} },
  ] } } ];
  const c = parseComments(json);
  assert.strictEqual(c.length, 1);
  assert.deepStrictEqual(c[0], { author: "bob", text: "lol great", score: 1234 });
});

test("fetchTopPost requests with a User-Agent and returns a post", async () => {
  let hdrs;
  const fakeFetch = async (url, opts) => { hdrs = opts.headers; return { ok: true, json: async () => ({ data: { children: [
    { data: { id: "z9", title: "What is the best?", over_18: false, stickied: false, num_comments: 800 } },
  ] } }) }; };
  const p = await fetchTopPost("AskReddit", { userAgent: "remo/1.0", fetchImpl: fakeFetch });
  assert.strictEqual(hdrs["User-Agent"], "remo/1.0");
  assert.strictEqual(p.id, "z9");
  assert.strictEqual(p.subreddit, "AskReddit");
});
```

- [ ] **Step 2: Run** `node --test pipeline/lib/reddit.test.js` → FAIL.

- [ ] **Step 3: Implement** `pipeline/lib/reddit.js`
```js
function parseListing(json) {
  return (json.data?.children || [])
    .map((c) => c.data)
    .filter((d) => d && !d.over_18 && !d.stickied && /\?\s*$/.test(d.title) && (d.num_comments || 0) >= 50)
    .map((d) => ({ id: d.id, title: d.title.trim(), num_comments: d.num_comments }));
}

function parseComments(json) {
  const children = json?.[1]?.data?.children || [];
  return children
    .filter((c) => c.kind === "t1" && c.data && c.data.body && !["[deleted]", "[removed]"].includes(c.data.body))
    .map((c) => ({ author: c.data.author, text: c.data.body.trim(), score: c.data.score || 0 }));
}

async function fetchTopPost(subreddit, { userAgent, fetchImpl = fetch, period = "week" }) {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${period}&limit=25`;
  const r = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
  if (!r.ok) throw new Error(`reddit listing HTTP ${r.status}`);
  const posts = parseListing(await r.json());
  if (!posts.length) throw new Error(`no suitable post in r/${subreddit}`);
  return { ...posts[0], subreddit };
}

async function fetchComments(subreddit, postId, { userAgent, fetchImpl = fetch }) {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}/.json?limit=80&sort=top`;
  const r = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
  if (!r.ok) throw new Error(`reddit comments HTTP ${r.status}`);
  return parseComments(await r.json());
}
module.exports = { parseListing, parseComments, fetchTopPost, fetchComments };
```

- [ ] **Step 4: Run** → PASS (3).

- [ ] **Step 5: Commit**
```bash
git add pipeline/lib/reddit.js pipeline/lib/reddit.test.js
git commit -m "feat: reddit top-post + comments fetch/parse"
```

---

### Task 3: ytcomments.js — YouTube top comments (optional source)

**Files:** Create `pipeline/lib/ytcomments.js`, `pipeline/lib/ytcomments.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const { parseThreads, fetchTopComments } = require("./ytcomments");

test("parseThreads maps comment threads to author/text/score", () => {
  const json = { items: [
    { snippet: { topLevelComment: { snippet: { authorDisplayName: "Ann", textOriginal: "haha", likeCount: 42 } } } },
  ] };
  assert.deepStrictEqual(parseThreads(json), [{ author: "Ann", text: "haha", score: 42 }]);
});

test("fetchTopComments returns [] on HTTP error (best-effort)", async () => {
  const fakeFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  const r = await fetchTopComments("vid", { apiKey: "K", fetchImpl: fakeFetch });
  assert.deepStrictEqual(r, []);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `pipeline/lib/ytcomments.js`
```js
function parseThreads(json) {
  return (json.items || []).map((it) => {
    const s = it.snippet.topLevelComment.snippet;
    return { author: s.authorDisplayName, text: s.textOriginal, score: s.likeCount || 0 };
  });
}
async function fetchTopComments(videoId, { apiKey, fetchImpl = fetch, max = 50 }) {
  const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=${max}&key=${apiKey}`;
  try {
    const r = await fetchImpl(url, {});
    if (!r.ok) return [];
    return parseThreads(await r.json());
  } catch (_) { return []; }
}
module.exports = { parseThreads, fetchTopComments };
```

- [ ] **Step 4: Run** → PASS (2).

- [ ] **Step 5: Commit**
```bash
git add pipeline/lib/ytcomments.js pipeline/lib/ytcomments.test.js
git commit -m "feat: youtube top-comments fetch/parse"
```

---

### Task 4: 01c-comments — fetch raw deck

**Files:** Create `pipeline/01c-comments.js`, `pipeline/01c-comments.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { fetchRawDeck } = require("./01c-comments");

test("fetchRawDeck picks a subreddit by seed, gathers comments, writes raw_deck.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cm-"));
  const deps = {
    getPost: async (sub) => ({ id: "p1", subreddit: sub, title: "What is best?" }),
    getComments: async () => [
      { author: "a", text: "one", score: 10 },
      { author: "b", text: "two", score: 99 },
    ],
  };
  const raw = await fetchRawDeck({ runId: "r1", runRoot, seed: "r1", subreddits: ["AskReddit", "tifu"], deps });
  assert.strictEqual(raw.question, "What is best?");
  assert.strictEqual(raw.comments.length, 2);
  const w = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "raw_deck.json"), "utf8"));
  assert.strictEqual(w.subreddit, raw.subreddit);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `pipeline/01c-comments.js`
```js
const { writeJSON, runPath } = require("./lib/fsx");
const { pickFrom } = require("./lib/seed");

// deps: { getPost(subreddit)->{id,subreddit,title}, getComments(subreddit,postId)->[{author,text,score}] }
async function fetchRawDeck({ runId, runRoot, seed, subreddits, deps }) {
  const sub = pickFrom(seed, subreddits);
  const post = await deps.getPost(sub);
  const comments = await deps.getComments(post.subreddit, post.id);
  const raw = { subreddit: post.subreddit, postId: post.id, question: post.title, comments };
  writeJSON(runPath(runRoot, runId, "raw_deck.json"), raw);
  return raw;
}
module.exports = { fetchRawDeck };

if (require.main === module) {
  const cfg = require("./config");
  const { fetchTopPost, fetchComments } = require("./lib/reddit");
  const ua = process.env.REDDIT_USER_AGENT || "remo-bot/1.0 (by /u/remo)";
  const deps = {
    getPost: (sub) => fetchTopPost(sub, { userAgent: ua }),
    getComments: (sub, id) => fetchComments(sub, id, { userAgent: ua }),
  };
  fetchRawDeck({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", seed: process.env.RUN_ID, subreddits: cfg.subreddits, deps })
    .then((d) => console.log("raw comments:", d.comments.length));
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/01c-comments.js pipeline/01c-comments.test.js
git commit -m "feat: stage 01c fetch raw reddit deck"
```

---

### Task 5: 02c-curate — LLM filter/rank → deck.json + meta

**Files:** Create `pipeline/02c-curate.js`, `pipeline/02c-curate.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { curateDeck } = require("./02c-curate");

test("curateDeck persists deck.json + meta.json from the LLM result", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cur-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "r1", "raw_deck.json"), JSON.stringify({
    subreddit: "AskReddit", postId: "p1", question: "What is best?",
    comments: [{ author: "a", text: "clean joke", score: 1234 }, { author: "b", text: "bad", score: 1 }],
  }));
  const fakeChat = async () => ({
    question: "What is best?",
    comments: [{ id: 1, author: "u/a", text: "clean joke", upvotes: "1.2k" }],
    title: "Funniest Reddit answers #shorts",
    description: "d", tags: ["reddit", "shorts"],
  });
  const deck = await curateDeck({ runId: "r1", runRoot, chat: fakeChat });
  assert.strictEqual(deck.comments.length, 1);
  const d = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "deck.json"), "utf8"));
  const m = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "meta.json"), "utf8"));
  assert.strictEqual(d.question, "What is best?");
  assert.strictEqual(d.subreddit, "AskReddit");
  assert.ok(m.tags.includes("shorts"));
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `pipeline/02c-curate.js`
```js
const { readJSON, writeJSON, runPath } = require("./lib/fsx");

const SYSTEM = `You curate a YouTube Shorts "funniest Reddit answers" video.
Given a question and raw comments, pick the 5-8 FUNNIEST, SAFE, self-contained comments.
HARD rules: NO slurs, NO NSFW/sexual, NO hate, NO personal info, NO links. Lightly clean typos/markdown; keep each comment under ~200 chars.
Respond ONLY JSON: {question, comments:[{id, author, text, upvotes}], title, description, tags}.
- Keep the question concise. author like "u/name". upvotes a human string like "12.4k".
- title <= 90 chars ending with " #shorts". tags 10-20 incl "reddit","askreddit","shorts".`;

async function curateDeck({ runId, runRoot, chat }) {
  const raw = readJSON(runPath(runRoot, runId, "raw_deck.json"));
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Subreddit: r/${raw.subreddit}\nQuestion: ${raw.question}\nComments:\n${raw.comments.map((c) => `(${c.score}) ${c.text}`).join("\n")}` },
  ];
  const out = await chat({ messages });
  const deck = {
    subreddit: raw.subreddit,
    question: out.question || raw.question,
    comments: (out.comments || []).map((c, i) => ({
      id: c.id || i + 1, author: c.author || "u/redditor", text: c.text, upvotes: c.upvotes || "1k",
    })),
  };
  const meta = { title: out.title, description: out.description, tags: out.tags, category_id: 23 };
  writeJSON(runPath(runRoot, runId, "deck.json"), deck);
  writeJSON(runPath(runRoot, runId, "meta.json"), meta);
  return deck;
}
module.exports = { curateDeck };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  curateDeck({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", chat })
    .then((d) => console.log("curated comments:", d.comments.length));
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/02c-curate.js pipeline/02c-curate.test.js
git commit -m "feat: stage 02c LLM curate deck + meta"
```

---

### Task 6: synthSegments — shared voiceover core

Extract the per-segment synth/concat/timing/caption loop so both modes share it.

**Files:** Create `pipeline/lib/voiceover-core.js`, `pipeline/lib/voiceover-core.test.js`; Modify `pipeline/03-voiceover.js`

- [ ] **Step 1: Write the failing test** `pipeline/lib/voiceover-core.test.js`
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { synthSegments } = require("./voiceover-core");

test("synthSegments synths each segment, concats, returns timings + captions", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-"));
  const synthed = [];
  const deps = {
    synth: async (text, out) => { synthed.push(text); fs.writeFileSync(out, "x"); return [{ text, offsetMs: 100, durationMs: 200 }]; },
    probeDuration: async () => 2.0,
    concat: async (_f, out) => fs.writeFileSync(out, "joined"),
  };
  const r = await synthSegments({ segments: [{ id: 1, narration: "one" }, { id: 2, narration: "two" }], audioDir: dir, voice: "v", rate: "+8%", deps });
  assert.deepStrictEqual(synthed, ["one", "two"]);
  assert.strictEqual(r.durations.length, 2);
  assert.strictEqual(r.timed.total_duration_sec, 4.0);
  assert.strictEqual(r.timed.scenes[1].audio_start_ms, 2000);
  assert.strictEqual(r.captions.length, 2);
  assert.deepStrictEqual(r.captions[0], { text: "one", startMs: 100, endMs: 300, timestampMs: 200, confidence: 1 });
  assert.ok(fs.existsSync(path.join(dir, "voiceover.mp3")));
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `pipeline/lib/voiceover-core.js`
```js
const fs = require("node:fs");
const path = require("node:path");
const { applyTimings, assembleCaptions } = require("./timeline");

// segments: [{id, narration}]. deps: { synth(text,out,voice,rate)->words[], probeDuration(file)->sec, concat(files,out) }
async function synthSegments({ segments, audioDir, voice, rate, deps }) {
  fs.mkdirSync(audioDir, { recursive: true });
  const files = [];
  const durations = [];
  const perWords = [];
  for (const s of segments) {
    const out = path.join(audioDir, `seg_${String(s.id).padStart(2, "0")}.mp3`);
    const words = await deps.synth(s.narration, out, voice, rate);
    perWords.push(words || []);
    durations.push(await deps.probeDuration(out));
    files.push(out);
  }
  await deps.concat(files, path.join(audioDir, "voiceover.mp3"));
  const timed = applyTimings(segments, durations);
  const startsMs = timed.scenes.map((s) => s.audio_start_ms);
  const captions = assembleCaptions(perWords, startsMs);
  return { durations, timed, captions };
}
module.exports = { synthSegments };
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Refactor `pipeline/03-voiceover.js` to use it (facts path unchanged in behavior).** Replace the body of `makeVoiceover` with:
```js
const { synthSegments } = require("./lib/voiceover-core");
const { writeJSON } = require("./lib/fsx");
// ... keep existing requires for readJSON/runPath/fs/path ...

async function makeVoiceover({ runId, runRoot, voice, rate, deps }) {
  const scenesPath = runPath(runRoot, runId, "scenes.json");
  const doc = readJSON(scenesPath);
  const audioDir = runPath(runRoot, runId, "audio");
  const segments = doc.scenes.map((s) => ({ id: s.id, narration: s.narration }));
  const { durations, timed, captions } = await synthSegments({ segments, audioDir, voice, rate, deps });
  doc.scenes = doc.scenes.map((s, i) => ({ ...s, ...timed.scenes[i], id: s.id }));
  doc.total_duration_sec = timed.total_duration_sec;
  writeJSON(scenesPath, doc);
  writeJSON(runPath(runRoot, runId, "captions.json"), captions);
  return doc;
}
```
Keep the existing `if (require.main === module)` CLI tail. Run `node --test pipeline/03-voiceover.test.js` → must still PASS (behavior preserved). Then `node --test "pipeline/**/*.test.js"` → all PASS.

- [ ] **Step 6: Commit**
```bash
git add pipeline/lib/voiceover-core.js pipeline/lib/voiceover-core.test.js pipeline/03-voiceover.js
git commit -m "refactor: shared synthSegments voiceover core"
```

---

### Task 7: makeCommentsVoiceover — deck → voiceover + captions + timed deck

**Files:** Create `pipeline/03c-voiceover-comments.js`, `pipeline/03c-voiceover-comments.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { makeCommentsVoiceover } = require("./03c-voiceover-comments");

test("makeCommentsVoiceover voices question+comments, writes timed deck + captions", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cvo-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "r1", "deck.json"), JSON.stringify({
    subreddit: "AskReddit", question: "What is best?",
    comments: [{ id: 1, author: "u/a", text: "one", upvotes: "1k" }, { id: 2, author: "u/b", text: "two", upvotes: "2k" }],
  }));
  const deps = {
    synth: async (_t, out) => { fs.writeFileSync(out, "x"); return [{ text: "w", offsetMs: 0, durationMs: 100 }]; },
    probeDuration: async () => 1.5,
    concat: async (_f, out) => fs.writeFileSync(out, "j"),
  };
  const deck = await makeCommentsVoiceover({ runId: "r1", runRoot, voice: "v", rate: "+8%", deps });
  // 3 segments: question + 2 comments
  assert.strictEqual(deck.total_duration_sec, 4.5);
  assert.strictEqual(deck.segments.length, 3);
  assert.strictEqual(deck.segments[0].kind, "question");
  assert.strictEqual(deck.segments[1].kind, "comment");
  assert.ok(fs.existsSync(path.join(runRoot, "r1", "captions.json")));
  assert.ok(fs.existsSync(path.join(runRoot, "r1", "audio", "voiceover.mp3")));
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `pipeline/03c-voiceover-comments.js`
```js
const { readJSON, writeJSON, runPath } = require("./lib/fsx");
const { synthSegments } = require("./lib/voiceover-core");

async function makeCommentsVoiceover({ runId, runRoot, voice, rate, deps }) {
  const deck = readJSON(runPath(runRoot, runId, "deck.json"));
  const segments = [
    { id: 1, narration: deck.question, kind: "question", author: null, upvotes: null, text: deck.question },
    ...deck.comments.map((c, i) => ({ id: i + 2, narration: c.text, kind: "comment", author: c.author, upvotes: c.upvotes, text: c.text })),
  ];
  const audioDir = runPath(runRoot, runId, "audio");
  const { timed, captions } = await synthSegments({ segments, audioDir, voice, rate, deps });
  deck.segments = segments.map((s, i) => ({
    kind: s.kind, author: s.author, upvotes: s.upvotes, text: s.text,
    duration_sec: timed.scenes[i].duration_sec, audio_start_ms: timed.scenes[i].audio_start_ms, audio_end_ms: timed.scenes[i].audio_end_ms,
  }));
  deck.total_duration_sec = timed.total_duration_sec;
  writeJSON(runPath(runRoot, runId, "deck.json"), deck);
  writeJSON(runPath(runRoot, runId, "captions.json"), captions);
  return deck;
}
module.exports = { makeCommentsVoiceover };

if (require.main === module) {
  const cfg = require("./config");
  const sh = require("./lib/sh");
  const deps = { synth: sh.synth, probeDuration: sh.probeDuration, concat: sh.concat };
  makeCommentsVoiceover({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", voice: cfg.voice, rate: cfg.ttsRate, deps })
    .then((d) => console.log("comments sec:", d.total_duration_sec));
}
```

- [ ] **Step 4: Run** → PASS. Then full suite PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/03c-voiceover-comments.js pipeline/03c-voiceover-comments.test.js
git commit -m "feat: comments voiceover (question + comments)"
```

---

# PHASE 2 — Background + Comments render

### Task 8: timeline — buildSegments props + parseUpvotes

**Files:** Modify `pipeline/lib/timeline.js`, `pipeline/lib/timeline.test.js`

- [ ] **Step 1: Append tests**
```js
const { buildCommentsProps, parseUpvotes } = require("./timeline");

test("parseUpvotes parses human strings to numbers", () => {
  assert.strictEqual(parseUpvotes("12.4k"), 12400);
  assert.strictEqual(parseUpvotes("999"), 999);
  assert.strictEqual(parseUpvotes("2.1m"), 2100000);
  assert.strictEqual(parseUpvotes(null), 0);
});

test("buildCommentsProps frames segments + wires background/sfx/accent", () => {
  const deck = {
    subreddit: "AskReddit", question: "Q?",
    segments: [
      { kind: "question", author: null, upvotes: null, text: "Q?", duration_sec: 2.0 },
      { kind: "comment", author: "u/a", upvotes: "1k", text: "c1", duration_sec: 1.0 },
    ],
  };
  const props = buildCommentsProps({
    runId: "r1", deck, captions: [], theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@h" },
    fps: 30, seed: "r1", accentPalette: ["#111", "#222"], musicSrc: "r1/music.mp3", musicVolume: 0.1, sfxSrc: "r1/sfx.mp3", backgroundSrc: "r1/bg.mp4",
  });
  assert.strictEqual(props.backgroundSrc, "r1/bg.mp4");
  assert.strictEqual(props.subreddit, "AskReddit");
  assert.strictEqual(props.segments[0].startFrame, 0);
  assert.strictEqual(props.segments[0].durationFrames, 60);
  assert.strictEqual(props.segments[1].startFrame, 60);
  assert.strictEqual(props.segments[1].durationFrames, 30);
  assert.ok(["#111", "#222"].includes(props.theme.accentColor));
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — append to `pipeline/lib/timeline.js` (before `module.exports`, then extend exports):
```js
function parseUpvotes(s) {
  if (!s) return 0;
  const m = String(s).trim().toLowerCase().match(/^([\d.]+)\s*([km]?)$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return Math.round(n * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1));
}

function buildCommentsProps({ runId, deck, captions, theme, fps, seed, accentPalette, musicSrc, musicVolume, sfxSrc, backgroundSrc }) {
  const accentColor = pickFrom(seed, accentPalette);
  let frame = 0;
  const segments = deck.segments.map((s) => {
    const durationFrames = Math.round(s.duration_sec * fps);
    const node = { kind: s.kind, author: s.author || null, upvotes: s.upvotes || null, text: s.text, startFrame: frame, durationFrames };
    frame += durationFrames;
    return node;
  });
  return {
    fps, width: 1080, height: 1920,
    audioSrc: `${runId}/voiceover.mp3`,
    musicSrc: musicSrc || null, musicVolume, sfxSrc: sfxSrc || null,
    backgroundSrc, subreddit: deck.subreddit, question: deck.question,
    theme: { ...theme, accentColor }, captions, segments,
  };
}
```
Update the exports line to also export `buildCommentsProps, parseUpvotes`.

- [ ] **Step 4: Run** → PASS. Full suite PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/lib/timeline.js pipeline/lib/timeline.test.js
git commit -m "feat: buildCommentsProps + parseUpvotes"
```

---

### Task 9: 05b-background — pick one background clip

**Files:** Create `pipeline/05b-background.js`, `pipeline/05b-background.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { fetchBackground } = require("./05b-background");

test("fetchBackground uses a local gameplay clip when present", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bg-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  const gp = path.join(runRoot, "gameplay"); fs.mkdirSync(gp, { recursive: true });
  fs.writeFileSync(path.join(gp, "clip.mp4"), "GP");
  const r = await fetchBackground({ runId: "r1", pubRoot, seed: "r1", gameplayDir: gp, find: async () => null, download: async () => {} });
  assert.strictEqual(r, "r1/bg.mp4");
  assert.strictEqual(fs.readFileSync(path.join(pubRoot, "r1", "bg.mp4"), "utf8"), "GP");
});

test("fetchBackground downloads stock when no gameplay clips", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bg-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  const dl = [];
  const r = await fetchBackground({ runId: "r1", pubRoot, seed: "r1", gameplayDir: path.join(runRoot, "none"),
    find: async () => ({ type: "video", url: "http://x/s.mp4", id: "1", provider: "pexelsVideo" }),
    download: async (url, dest) => { dl.push(url); fs.writeFileSync(dest, "S"); } });
  assert.strictEqual(r, "r1/bg.mp4");
  assert.deepStrictEqual(dl, ["http://x/s.mp4"]);
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `pipeline/05b-background.js`
```js
const fs = require("node:fs");
const path = require("node:path");
const { pickFrom } = require("./lib/seed");

const QUERIES = ["satisfying loop", "abstract flowing", "oddly satisfying", "calm waves", "neon motion"];

// find(query)->candidate|null (single best); download(url,dest)
async function fetchBackground({ runId, pubRoot, seed, gameplayDir, find, download }) {
  const dest = path.join(pubRoot, runId, "bg.mp4");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // prefer a local gameplay clip
  try {
    if (gameplayDir && fs.existsSync(gameplayDir)) {
      const clips = fs.readdirSync(gameplayDir).filter((f) => /\.(mp4|webm|mov)$/i.test(f));
      if (clips.length) {
        fs.copyFileSync(path.join(gameplayDir, pickFrom(seed, clips)), dest);
        return `${runId}/bg.mp4`;
      }
    }
  } catch (_) { /* fall through to stock */ }
  const hit = await find(pickFrom(`${seed}:bg`, QUERIES));
  if (!hit) throw new Error("no background clip available");
  await download(hit.url, dest);
  return `${runId}/bg.mp4`;
}
module.exports = { fetchBackground };

if (require.main === module) {
  const cfg = require("./config");
  const { findMediaCandidates } = require("./lib/stock");
  const providers = require("./lib/providers");
  const { download } = require("./lib/download");
  const provFns = {
    pexelsVideo: (q) => providers.pexelsVideoCandidates(q, { apiKey: process.env.PEXELS_API_KEY }),
    pixabayVideo: (q) => providers.pixabayVideoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
  };
  const find = async (q) => (await findMediaCandidates(q, ["pexelsVideo", "pixabayVideo"], provFns))[0] || null;
  fetchBackground({ runId: process.env.RUN_ID, pubRoot: "remotion/public", seed: process.env.RUN_ID, gameplayDir: cfg.gameplay.dir, find, download })
    .then((s) => console.log("bg:", s));
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/05b-background.js pipeline/05b-background.test.js
git commit -m "feat: stage 05b background clip (gameplay or stock)"
```

---

### Task 10: schema — commentsSchema

**Files:** Modify `remotion/src/schema.ts`

- [ ] **Step 1: Implement** — append to `remotion/src/schema.ts`:
```ts
export const segmentSchema = z.object({
  kind: z.enum(["question", "comment"]),
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
```

- [ ] **Step 2: Structural check**
Run: `node -e "const s=require('node:fs').readFileSync('remotion/src/schema.ts','utf8'); ['commentsSchema','segmentSchema','backgroundSrc'].forEach(k=>{if(!s.includes(k))throw new Error(k)});console.log('OK')"`

- [ ] **Step 3: Commit**
```bash
git add remotion/src/schema.ts
git commit -m "feat: comments composition schema"
```

---

### Task 11: components — BackgroundClip, QuestionCard, CommentCard, CommentsEndCard

**Files:** Create the four files under `remotion/src/components/`.

- [ ] **Step 1: BackgroundClip.tsx**
```tsx
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { Video } from "@remotion/media";

export const BackgroundClip: React.FC<{ src: string }> = ({ src }) => (
  <AbsoluteFill style={{ backgroundColor: "#0b0b12" }}>
    <Video src={staticFile(src)} loop muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(6px) brightness(0.5)" }} />
  </AbsoluteFill>
);
```

- [ ] **Step 2: QuestionCard.tsx**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const QuestionCard: React.FC<{ subreddit: string; question: string; fontFamily: string; accentColor: string }> = ({
  subreddit, question, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 12], [-40, 0], { extrapolateRight: "clamp" });
  const o = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 120 }}>
      <div style={{ transform: `translateY(${y}px)`, opacity: o, width: "88%", background: "white", borderRadius: 22, padding: "22px 26px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: accentColor }} />
          <div style={{ fontFamily, fontWeight: 800, fontSize: 30, color: "#1a1a1b" }}>r/{subreddit}</div>
        </div>
        <div style={{ fontFamily, fontWeight: 800, fontSize: 44, color: "#1a1a1b", lineHeight: 1.15 }}>{question}</div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: CommentCard.tsx**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const CommentCard: React.FC<{ author: string; upvotes: string; text: string; fontFamily: string; accentColor: string }> = ({
  author, upvotes, text, fontFamily, accentColor,
}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 10], [60, 0], { extrapolateRight: "clamp" });
  const o = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 40 }}>
      <div style={{ transform: `translateX(${x}px)`, opacity: o, width: "90%", background: "white", borderRadius: 20, padding: "24px 26px", boxShadow: "0 12px 34px rgba(0,0,0,0.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: accentColor }} />
          <div style={{ fontFamily, fontWeight: 800, fontSize: 30, color: "#1a1a1b" }}>{author}</div>
          <div style={{ marginLeft: "auto", fontFamily, fontWeight: 800, fontSize: 30, color: "#ff4500" }}>⬆ {upvotes}</div>
        </div>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 46, color: "#1a1a1b", lineHeight: 1.25 }}>{text}</div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: CommentsEndCard.tsx**
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const CommentsEndCard: React.FC<{ channel: string; fontFamily: string; accentColor: string }> = ({ channel, fontFamily, accentColor }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const pulse = 1 + 0.05 * Math.sin(frame / 5);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o }}>
      <div style={{ fontFamily, fontWeight: 800, fontSize: 64, color: "white", textAlign: "center", WebkitTextStroke: "4px black", paintOrder: "stroke fill", marginBottom: 24 }}>Comment your favorite! 💬</div>
      <div style={{ transform: `scale(${pulse})`, background: "#FF0033", color: "white", fontFamily, fontWeight: 800, fontSize: 46, padding: "12px 40px", borderRadius: 999 }}>▶ FOLLOW for daily Reddit</div>
      <div style={{ fontFamily, fontSize: 38, color: "white", marginTop: 18, opacity: 0.9 }}>{channel}</div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 5: Structural check + commit**
Run: `node -e "['BackgroundClip','QuestionCard','CommentCard','CommentsEndCard'].forEach(n=>require('node:fs').readFileSync('remotion/src/components/'+n+'.tsx','utf8'));console.log('OK')"`
```bash
git add remotion/src/components/BackgroundClip.tsx remotion/src/components/QuestionCard.tsx remotion/src/components/CommentCard.tsx remotion/src/components/CommentsEndCard.tsx
git commit -m "feat: comments composition components"
```

---

### Task 12: Comments.tsx composition + Root registration

**Files:** Create `remotion/src/Comments.tsx`; Modify `remotion/src/Root.tsx`

- [ ] **Step 1: Comments.tsx**
```tsx
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
      <Sequence from={segments[segments.length - 1].startFrame} durationInFrames={segments[segments.length - 1].durationFrames}>
        <CommentsEndCard channel={theme.channelName} fontFamily={ff} accentColor={accent} />
      </Sequence>
      <ProgressBar accentColor={accent} />
    </AbsoluteFill>
  );
};
```
NOTE: the question is read during segment 0; the `QuestionCard` stays visible the whole video (intentional — it anchors context). The final segment also shows the end card.

- [ ] **Step 2: Root.tsx** — add the second composition. Add import + a `<Composition>` next to the existing `Short` one:
```tsx
import { Comments } from "./Comments";
import { commentsSchema, type CommentsProps } from "./schema";

const commentsDefault: CommentsProps = {
  fps: 30, width: 1080, height: 1920, audioSrc: "", musicSrc: null, musicVolume: 0.1, sfxSrc: null,
  backgroundSrc: "", subreddit: "AskReddit", question: "",
  theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@channel" }, captions: [], segments: [],
};
```
And inside `RemotionRoot`'s returned fragment, after the existing `<Composition id="Short" .../>`, add:
```tsx
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
```
If `RemotionRoot` currently returns a single `<Composition>` without a wrapping fragment, wrap both in `<>...</>`.

- [ ] **Step 3: Structural check + commit**
Run: `node -e "const r=require('node:fs').readFileSync('remotion/src/Root.tsx','utf8'); if(!r.includes('id=\"Comments\"')||!r.includes('commentsSchema'))throw new Error('root'); require('node:fs').readFileSync('remotion/src/Comments.tsx','utf8'); console.log('OK')"`
```bash
git add remotion/src/Comments.tsx remotion/src/Root.tsx
git commit -m "feat: Comments composition + Root registration"
```

---

### Task 13: 06-render — comments branch (prepareCommentsRender)

**Files:** Modify `pipeline/06-render.js`, `pipeline/06-render.test.js`

- [ ] **Step 1: Append test**
```js
const { prepareCommentsRender } = require("./06-render");

test("prepareCommentsRender copies audio + builds comments props", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cr-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpub-"));
  const dir = path.join(runRoot, "r1"); fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.mkdirSync(path.join(pubRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(dir, "audio", "voiceover.mp3"), "AUDIO");
  fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify([]));
  fs.writeFileSync(path.join(dir, "deck.json"), JSON.stringify({
    subreddit: "AskReddit", question: "Q?",
    segments: [{ kind: "question", author: null, upvotes: null, text: "Q?", duration_sec: 2.0 },
               { kind: "comment", author: "u/a", upvotes: "1k", text: "c", duration_sec: 1.0 }],
  }));
  const props = prepareCommentsRender({
    runId: "r1", runRoot, pubRoot, theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@h" },
    fps: 30, seed: "r1", accentPalette: ["#111"], musicDir: path.join(runRoot, "no"), musicVolume: 0.1, sfxDir: path.join(runRoot, "no"),
  });
  assert.strictEqual(props.backgroundSrc, "r1/bg.mp4");
  assert.strictEqual(props.segments[1].durationFrames, 30);
  assert.strictEqual(fs.readFileSync(path.join(pubRoot, "r1", "voiceover.mp3"), "utf8"), "AUDIO");
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — in `pipeline/06-render.js`:
Add `const { buildCommentsProps } = require("./lib/timeline");` to the existing timeline require (extend the destructure to include it).
Add this function after `prepareRender`:
```js
function prepareCommentsRender({ runId, runRoot, pubRoot, theme, fps, seed, accentPalette, musicDir, musicVolume, sfxDir }) {
  const deck = readJSON(runPath(runRoot, runId, "deck.json"));
  const captions = readJSON(runPath(runRoot, runId, "captions.json"));
  const destBase = path.join(pubRoot, runId);
  fs.mkdirSync(destBase, { recursive: true });
  fs.copyFileSync(runPath(runRoot, runId, "audio", "voiceover.mp3"), path.join(destBase, "voiceover.mp3"));
  const musicSrc = pickAsset(musicDir, seed, destBase, "music.mp3", runId);
  const sfxSrc = pickAsset(sfxDir, `${seed}:sfx`, destBase, "sfx.mp3", runId);
  const backgroundSrc = `${runId}/bg.mp4`; // produced by stage 05b
  return buildCommentsProps({ runId, deck, captions, theme, fps, seed, accentPalette, musicSrc, musicVolume, sfxSrc, backgroundSrc });
}
```
Add a `renderComments(...)` mirroring `render()` but using composition id `"Comments"` and `prepareCommentsRender`:
```js
async function renderComments({ runId, runRoot, pubRoot, theme, fps, outFile }) {
  const cfg = require("./config");
  const inputProps = prepareCommentsRender({ runId, runRoot, pubRoot, theme, fps, seed: runId, accentPalette: cfg.accentPalette, musicDir: cfg.music.dir, musicVolume: cfg.music.volume, sfxDir: cfg.sfx.dir });
  const { bundle } = require("@remotion/bundler");
  const { renderMedia, selectComposition } = require("@remotion/renderer");
  const serveUrl = await bundle({ entryPoint: path.resolve("remotion/src/index.ts") });
  const composition = await selectComposition({ serveUrl, id: "Comments", inputProps });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: outFile, inputProps });
  return outFile;
}
```
Extend `module.exports` to include `prepareCommentsRender, renderComments`.

- [ ] **Step 4: Run** → PASS. Full suite PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/06-render.js pipeline/06-render.test.js
git commit -m "feat: comments render (prepareCommentsRender + renderComments)"
```

---

# PHASE 3 — Upload routing + CI

### Task 14: upload_youtube.py — selectable refresh-token env

**Files:** Modify `scripts/upload_youtube.py`

- [ ] **Step 1: Implement** — change `service()` to accept an env-var name:
```python
def service(refresh_env="YOUTUBE_REFRESH_TOKEN"):
    creds = Credentials(
        token=None,
        refresh_token=os.environ[refresh_env],
        client_id=os.environ["YOUTUBE_CLIENT_ID"],
        client_secret=os.environ["YOUTUBE_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/youtube"],
    )
    return build("youtube", "v3", credentials=creds)
```
Add `--refresh-token-env` to each subparser (default `YOUTUBE_REFRESH_TOKEN`) and pass it into `service(a.refresh_token_env)` in `cmd_upload`, `cmd_publish`, `cmd_delete`. Example for upload parser:
```python
    u.add_argument("--refresh-token-env", default="YOUTUBE_REFRESH_TOKEN")
```
and in `cmd_upload`: `yt = service(a.refresh_token_env)` (same change in publish/delete).

- [ ] **Step 2: Verify compiles**
Run: `python -m py_compile scripts/upload_youtube.py && echo COMPILE_OK`

- [ ] **Step 3: Commit**
```bash
git add scripts/upload_youtube.py
git commit -m "feat: upload_youtube selectable refresh-token env"
```

---

### Task 15: run.js — mode branch

**Files:** Modify `pipeline/run.js`

- [ ] **Step 1: Implement** — in `pipeline/run.js`, wrap the content+render in a mode branch. Replace the topic→render body (from `pickTopic` through `render(...)`) so that:

For `cfg.mode === "comments"`:
```js
  if (cfg.mode === "comments") {
    const { fetchRawDeck } = require("./01c-comments");
    const { curateDeck } = require("./02c-curate");
    const { makeCommentsVoiceover } = require("./03c-voiceover-comments");
    const { fetchBackground } = require("./05b-background");
    const { renderComments } = require("./06-render");
    const { fetchTopPost, fetchComments } = require("./lib/reddit");
    const ua = process.env.REDDIT_USER_AGENT || "remo-bot/1.0 (by /u/remo)";
    await fetchRawDeck({ runId, runRoot, seed: runId, subreddits: cfg.subreddits, deps: {
      getPost: (sub) => fetchTopPost(sub, { userAgent: ua }),
      getComments: (sub, id) => fetchComments(sub, id, { userAgent: ua }),
    }});
    await curateDeck({ runId, runRoot, chat });
    const voDeps = { synth: sh.synth, probeDuration: sh.probeDuration, concat: sh.concat };
    await makeCommentsVoiceover({ runId, runRoot, voice: cfg.voice, rate: cfg.ttsRate, deps: voDeps });
    const { findMediaCandidates } = require("./lib/stock");
    const bgFind = async (q) => (await findMediaCandidates(q, ["pexelsVideo", "pixabayVideo"], {
      pexelsVideo: (x) => providers.pexelsVideoCandidates(x, { apiKey: process.env.PEXELS_API_KEY }),
      pixabayVideo: (x) => providers.pixabayVideoCandidates(x, { apiKey: process.env.PIXABAY_API_KEY }),
    }))[0] || null;
    await fetchBackground({ runId, pubRoot: "remotion/public", seed: runId, gameplayDir: cfg.gameplay.dir, find: bgFind, download });
    const outFile = `out/${runId}.mp4`;
    await renderComments({ runId, runRoot, pubRoot: "remotion/public", theme: cfg.theme, fps: cfg.render.fps, outFile });
    const nextHistory = addEntry(history, { mode: "comments", slug: `reddit-${runId}`, topic: "reddit", status: "pending", runId });
    writeJSON(historyPath, nextHistory);
    console.log(JSON.stringify({ runId, mode: "comments", outFile }));
    return;
  }
```
Place this block right after `history`/`chat` are defined and BEFORE the existing facts topic logic. Keep the existing facts flow as the `else` path (it already runs when mode !== comments). Ensure `providers`, `download`, `sh`, `addEntry`, `writeJSON`, `historyPath` are in scope (they already are in run.js).

- [ ] **Step 2: Verify module loads** — `node -e "require('./pipeline/run.js'); console.log('OK')"` → `OK`.

- [ ] **Step 3: Full suite** — `node --test "pipeline/**/*.test.js"` → all PASS.

- [ ] **Step 4: Commit**
```bash
git add pipeline/run.js
git commit -m "feat: run.js comments mode branch"
```

---

### Task 16: produce.yml — mode input + comments secrets; gitignore + docs

**Files:** Modify `.github/workflows/produce.yml`, `.gitignore`; Create `remotion/public/gameplay/README.md`; Modify `docs/SECRETS.md`

- [ ] **Step 1: produce.yml** — add a `mode` input and thread MODE + comments secrets:
Under `on: workflow_dispatch:` add:
```yaml
    inputs:
      mode:
        description: "facts or comments"
        required: false
        default: "facts"
```
In the "Run pipeline" step `env:`, add:
```yaml
          MODE: ${{ inputs.mode }}
          REDDIT_USER_AGENT: ${{ secrets.REDDIT_USER_AGENT }}
          YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}
```
In the "Upload to YouTube (private)" step, make the refresh-token env conditional. Add to that step's `env:`:
```yaml
          YOUTUBE_REFRESH_TOKEN: ${{ secrets.YOUTUBE_REFRESH_TOKEN }}
          YT_COMMENTS_REFRESH_TOKEN: ${{ secrets.YT_COMMENTS_REFRESH_TOKEN }}
```
and change the python upload invocation to pass the right env name:
```bash
          ID=${{ steps.runid.outputs.id }}
          if [ "${{ inputs.mode }}" = "comments" ]; then RT=YT_COMMENTS_REFRESH_TOKEN; else RT=YOUTUBE_REFRESH_TOKEN; fi
          python scripts/upload_youtube.py upload \
            --video out/$ID.mp4 --meta run/$ID/meta.json --privacy private \
            --refresh-token-env $RT --out run/$ID/upload.json
          cat run/$ID/upload.json
```

- [ ] **Step 2: .gitignore** — after the sfx exceptions add:
```
!remotion/public/gameplay/
!remotion/public/gameplay/*.mp4
```

- [ ] **Step 3: gameplay README** — create `remotion/public/gameplay/README.md`:
```markdown
# Gameplay background clips

Optional. Drop royalty-free / your-own gameplay `.mp4` clips here (e.g. parkour).
For `comments` mode the pipeline picks one (seeded) as the blurred background.
Empty folder = the pipeline downloads a satisfying stock clip instead.
```

- [ ] **Step 4: SECRETS.md** — append:
```markdown

## Comments mode secrets
| Secret | Purpose |
|---|---|
| REDDIT_USER_AGENT | e.g. `remo-bot/1.0 (by /u/yourname)` — required by Reddit JSON |
| YOUTUBE_API_KEY | YouTube Data API key (optional YouTube comments source) |
| YT_COMMENTS_REFRESH_TOKEN | refresh token for the SECOND channel (authorize via scripts/get_youtube_token.js) |

Produce comments: `gh workflow run produce.yml -f mode=comments`
```

- [ ] **Step 5: Validate YAML + commit**
Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/produce.yml')); print('YAML_OK')"`
```bash
git add .github/workflows/produce.yml .gitignore remotion/public/gameplay/README.md docs/SECRETS.md
git commit -m "ci: comments mode input + secrets + gameplay folder"
```

---

### Task 17: full suite + verification

- [ ] **Step 1** — `node --test "pipeline/**/*.test.js"` → ALL pass (incl reddit, ytcomments, 01c, 02c, voiceover-core, 03c, timeline, 05b, 06-render comments).
- [ ] **Step 2** — `node -e "require('./pipeline/run.js'); console.log('OK')"` → OK.
- [ ] **Step 3** — confirm `git status` clean.

---

## Self-Review

**Spec coverage:** §2 mode switch → Tasks 1,15. §3.1 reddit/yt fetch → Tasks 2,3,4. §3.2 curate → Task 5. §3.3 shared voiceover → Tasks 6,7. §4 Comments composition → Tasks 10,11,12. §4.2 props → Tasks 8,13. §5 background → Task 9. §6 second-channel upload → Tasks 14,16. §7 CI → Task 16. All covered.

**Placeholder scan:** none — concrete code/commands throughout.

**Type consistency:** `deck` shape (subreddit/question/comments[{id,author,text,upvotes}]) consistent across 02c (Task 5), 03c (Task 7), buildCommentsProps (Task 8). `segments` shape (kind/author/upvotes/text/startFrame/durationFrames) consistent across 03c, buildCommentsProps, segmentSchema (Task 10), Comments.tsx (Task 12). `synthSegments` return `{durations,timed,captions}` used by both 03 (Task 6) and 03c (Task 7). `prepareCommentsRender`/`renderComments` (Task 13) consume deck.json from 03c and bg.mp4 from 05b (Task 9). `pickAsset` reused (defined in the facts annotations plan, exists in 06-render). Upload `--refresh-token-env` (Task 14) used by produce.yml (Task 16). `cfg.mode/subreddits/gameplay.dir/commentsTokenEnv` (Task 1) used in run.js (Task 15) + 05b (Task 9). Consistent.
