# remo Video Factory Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static GitHub Pages dashboard (separate public repo) that tracks remo's two channels (queue, published, live views/likes) and lets you trigger production (channel + optional topic) which schedules the video into the publish queue — all without the CLI.

**Architecture:** remo (private) gains `build_dashboard.js` (history + YouTube stats → `dashboard.json`) and a `dashboard.yml` workflow that pushes `dashboard.json` to a public `remo-dashboard` repo. The dashboard repo is a static site (HTML/JS/CSS) on GitHub Pages that reads `dashboard.json` and triggers `produce.yml` via the GitHub API using a browser-stored PAT. `produce.yml` gains an optional `topic` input.

**Tech Stack:** Node 20 CommonJS + `node:test`, GitHub Actions, GitHub Pages, vanilla JS + Tailwind CDN, YouTube Data API. No new npm dependency.

---

## Data contract (`dashboard.json`)
```json
{ "updated_at": "ISO",
  "channels": { "facts": {"name","handle","niche","accent"}, "money": {...} },
  "videos": [ { "video_id","url","mode","topic","status","publish_at","runId","views","likes","thumbnail" } ],
  "metrics": { "scheduled","published","today","total_views" } }
```

---

# PHASE 1 — remo data publisher + topic override

### Task 1: build_dashboard.js — pure buildDashboard

**Files:** Create `scripts/build_dashboard.js`, `scripts/build_dashboard.test.js`

- [ ] **Step 1: Write the failing test**
```js
const test = require("node:test");
const assert = require("node:assert");
const { buildDashboard, todayKey } = require("./build_dashboard");

const channels = {
  facts: { name: "DustMust", handle: "@DustMust", niche: "Facts", accent: "#FFD400" },
  money: { name: "Fun Honey", handle: "@FunHoney", niche: "Money", accent: "#16C784" },
};

test("buildDashboard maps videos, stats, thumbnails, metrics", () => {
  const history = { entries: [
    { video_id: "a", url: "u/a", mode: "facts", topic: "Sloths", status: "scheduled", publish_at: "2026-06-14T09:00:00Z", runId: "run-20260613-101010" },
    { video_id: "b", url: "u/b", mode: "money", topic: "Pricing", status: "published", runId: "run-20260612-101010" },
    { slug: "no-video-yet", status: "pending" },
  ]};
  const stats = { b: { views: 1000, likes: 50 } };
  const d = buildDashboard(history, stats, channels, "2026-06-13T12:00:00Z");
  assert.strictEqual(d.videos.length, 2); // entries without video_id dropped
  assert.strictEqual(d.videos[0].thumbnail, "https://img.youtube.com/vi/a/hqdefault.jpg");
  assert.strictEqual(d.videos[1].views, 1000);
  assert.strictEqual(d.metrics.scheduled, 1);
  assert.strictEqual(d.metrics.published, 1);
  assert.strictEqual(d.metrics.today, 1); // run-20260613 == 2026-06-13
  assert.strictEqual(d.metrics.total_views, 1000);
  assert.strictEqual(d.updated_at, "2026-06-13T12:00:00Z");
  assert.strictEqual(d.channels.facts.name, "DustMust");
});

test("todayKey extracts YYYYMMDD from an ISO date", () => {
  assert.strictEqual(todayKey("2026-06-13T12:00:00Z"), "20260613");
});
```

- [ ] **Step 2: Run** `node --test scripts/build_dashboard.test.js` → FAIL.

- [ ] **Step 3: Implement** `scripts/build_dashboard.js`
```js
function todayKey(iso) {
  return iso.slice(0, 10).replace(/-/g, "");
}

function buildDashboard(history, statsById, channels, nowIso) {
  const tk = todayKey(nowIso);
  const videos = (history.entries || [])
    .filter((e) => e.video_id)
    .map((e) => {
      const st = statsById[e.video_id] || {};
      return {
        video_id: e.video_id,
        url: e.url || `https://youtu.be/${e.video_id}`,
        mode: e.mode || "facts",
        topic: e.topic || e.slug || "",
        status: e.status || "pending",
        publish_at: e.publish_at || null,
        runId: e.runId || null,
        views: st.views || 0,
        likes: st.likes || 0,
        thumbnail: `https://img.youtube.com/vi/${e.video_id}/hqdefault.jpg`,
      };
    });
  const metrics = {
    scheduled: videos.filter((v) => v.status === "scheduled").length,
    published: videos.filter((v) => v.status === "published").length,
    today: videos.filter((v) => (v.runId || "").includes(`-${tk}-`)).length,
    total_views: videos.reduce((a, v) => a + (v.views || 0), 0),
  };
  return { updated_at: nowIso, channels, videos, metrics };
}

// stats fetch is injected for testing
async function fetchStats(videoIds, apiKey, fetchImpl = fetch) {
  const out = {};
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(",")}&key=${apiKey}`;
    try {
      const r = await fetchImpl(url, {});
      if (!r.ok) continue;
      const d = await r.json();
      for (const it of d.items || []) {
        out[it.id] = { views: Number(it.statistics.viewCount || 0), likes: Number(it.statistics.likeCount || 0) };
      }
    } catch (_) { /* best-effort */ }
  }
  return out;
}

module.exports = { buildDashboard, todayKey, fetchStats };

if (require.main === module) {
  const fs = require("node:fs");
  const channels = {
    facts: { name: "DustMust", handle: "@DustMust", niche: "İlginç bilgiler", accent: "#FFD400" },
    money: { name: "Fun Honey", handle: "@FunHoney", niche: "Para & finans", accent: "#16C784" },
  };
  const history = fs.existsSync("state/history.json") ? JSON.parse(fs.readFileSync("state/history.json", "utf8")) : { entries: [] };
  const ids = history.entries.filter((e) => e.video_id && e.status !== "rejected").map((e) => e.video_id);
  const nowIso = process.env.NOW_ISO || new Date().toISOString();
  fetchStats(ids, process.env.YOUTUBE_API_KEY).then((stats) => {
    const dash = buildDashboard(history, stats, channels, nowIso);
    fs.writeFileSync(process.env.OUT || "dashboard.json", JSON.stringify(dash, null, 2));
    console.log("dashboard.json videos:", dash.videos.length, "views:", dash.metrics.total_views);
  });
}
```
NOTE: the CLI uses `new Date().toISOString()` only at runtime (CI), never in tests (tests pass `nowIso`).

- [ ] **Step 4: Run** `node --test scripts/build_dashboard.test.js` → PASS (2). Then `node --test "pipeline/**/*.test.js"` still PASS (unaffected).

- [ ] **Step 5: Commit**
```bash
git add scripts/build_dashboard.js scripts/build_dashboard.test.js
git commit -m "feat: build_dashboard (history + youtube stats -> dashboard.json)"
```

---

### Task 2: topic override in topic stages

**Files:** Modify `pipeline/01-topic.js`, `pipeline/01m-topic.js`, `pipeline/01-topic.test.js`

- [ ] **Step 1: Append test** to `pipeline/01-topic.test.js`:
```js
test("pickTopic with override skips the model and uses the given topic", async () => {
  const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ovr-"));
  let called = false;
  const chat = async () => { called = true; return {}; };
  const r = await pickTopic({ runId: "r1", runRoot, history: { entries: [] }, chat, override: "Why cats purr" });
  assert.strictEqual(called, false);
  assert.strictEqual(r.topic, "Why cats purr");
  assert.strictEqual(r.slug, "why-cats-purr");
  const w = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "topic.json"), "utf8"));
  assert.strictEqual(w.topic, "Why cats purr");
});
```

- [ ] **Step 2: Run** `node --test pipeline/01-topic.test.js` → FAIL.

- [ ] **Step 3: Implement** — in `pipeline/01-topic.js`, change `pickTopic` signature to accept `override` and short-circuit:
```js
async function pickTopic({ runId, runRoot, history, chat, override }) {
  let topic;
  if (override && String(override).trim()) {
    const t = String(override).trim();
    topic = { topic: t, angle: "", why_interesting: "", slug: t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) };
  } else {
    const avoid = recentTopics(history);
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Avoid these already-used topics: ${JSON.stringify(avoid)}. Give one fresh, distinct topic.` },
    ];
    topic = await chat({ messages });
  }
  writeJSON(runPath(runRoot, runId, "topic.json"), topic);
  return topic;
}
```
Apply the SAME pattern to `pipeline/01m-topic.js` `pickMoneyTopic` (override branch builds the same object; otherwise the existing money SYSTEM prompt path). In each file's CLI tail (`require.main`), pass `override: process.env.TOPIC` to the call.

- [ ] **Step 4: Run** `node --test pipeline/01-topic.test.js` → PASS. Then full suite PASS.

- [ ] **Step 5: Commit**
```bash
git add pipeline/01-topic.js pipeline/01m-topic.js pipeline/01-topic.test.js
git commit -m "feat: optional topic override in topic stages"
```

---

### Task 3: run.js passes TOPIC override; produce.yml topic input

**Files:** Modify `pipeline/run.js`, `.github/workflows/produce.yml`

- [ ] **Step 1: run.js** — in BOTH the `facts` topic loop and the `money` branch's topic loop, pass `override: process.env.TOPIC` to `pickTopic`/`pickMoneyTopic`. E.g. facts:
```js
    topic = await pickTopic({ runId, runRoot, history, chat, override: process.env.TOPIC });
```
and money:
```js
      topic = await pickMoneyTopic({ runId, runRoot, history, chat, override: process.env.TOPIC });
```
(When `TOPIC` is unset/empty, behavior is unchanged.)

- [ ] **Step 2: produce.yml** — add a `topic` input and pass it to the pipeline env.
Under `workflow_dispatch.inputs`, add:
```yaml
      topic:
        description: "optional exact topic (blank = auto)"
        required: false
        default: ""
```
In the "Run pipeline" step `env:`, add:
```yaml
          TOPIC: ${{ inputs.topic }}
```

- [ ] **Step 3: Verify** — `node -e "require('./pipeline/run.js'); console.log('OK')"` → OK. `python -c "import yaml; yaml.safe_load(open('.github/workflows/produce.yml')); print('YAML_OK')"` → YAML_OK. Full suite PASS.

- [ ] **Step 4: Commit**
```bash
git add pipeline/run.js .github/workflows/produce.yml
git commit -m "feat: produce.yml topic input -> TOPIC override"
```

---

### Task 4: dashboard.yml workflow

**Files:** Create `.github/workflows/dashboard.yml`; Modify `docs/SECRETS.md`

- [ ] **Step 1: Create** `.github/workflows/dashboard.yml`
```yaml
name: dashboard
on:
  schedule:
    - cron: "0 * * * *"   # hourly
  workflow_run:
    workflows: ["produce", "publish"]
    types: [completed]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  publish-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - name: Build dashboard.json
        env:
          YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}
          OUT: dashboard.json
        run: node scripts/build_dashboard.js
      - name: Push to dashboard repo
        env:
          GH_TOKEN: ${{ secrets.DASHBOARD_DEPLOY_TOKEN }}
        run: |
          git clone --depth 1 https://x-access-token:${GH_TOKEN}@github.com/admlyz5858/remo-dashboard.git dash
          cp dashboard.json dash/dashboard.json
          cd dash
          git config user.name "remo-bot"
          git config user.email "bot@remo"
          git add dashboard.json
          git commit -m "data: refresh dashboard $(date -u +%FT%TZ)" || echo "no change"
          git push || echo "push skipped"
```

- [ ] **Step 2: SECRETS.md** — append:
```markdown

## Dashboard
| Secret | Purpose |
|---|---|
| DASHBOARD_DEPLOY_TOKEN | PAT with write access to the public `remo-dashboard` repo (pushes dashboard.json) |

The dashboard's "Produce" button uses a SEPARATE PAT stored in your browser (Actions write on remo), never committed.
```

- [ ] **Step 3: Validate + commit**
```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/dashboard.yml')); print('YAML_OK')"
git add .github/workflows/dashboard.yml docs/SECRETS.md
git commit -m "ci: dashboard.yml builds + pushes dashboard.json to public repo"
```

---

# PHASE 2 — Dashboard site (public repo files)

> Build these files under a local `dashboard-site/` folder in remo (gitignored), then Phase 3 creates the public repo and pushes them. Add `dashboard-site/` to remo `.gitignore`.

### Task 5: dashboard skeleton + pure slot logic

**Files:** Create `dashboard-site/app.js` with a tested pure helper first via a Node test mirror.

- [ ] **Step 1: gitignore** — add `dashboard-site/` to remo `.gitignore`. Commit:
```bash
echo "dashboard-site/" >> .gitignore
git add .gitignore && git commit -m "chore: ignore local dashboard-site build dir"
```

- [ ] **Step 2: Write a tested pure slot helper** `scripts/next_slot.js` + `scripts/next_slot.test.js` (reused by the browser via copy; tested in Node):
```js
// scripts/next_slot.js
const SLOTS = { facts: [9, 15], money: [11, 17] }; // UTC hours, staggered

function nextSlotIso(videos, mode, nowMs) {
  const slots = SLOTS[mode] || [9, 15];
  const sched = (videos || [])
    .filter((v) => v.mode === mode && v.publish_at)
    .map((v) => Date.parse(v.publish_at))
    .filter((n) => !isNaN(n));
  let after = nowMs;
  if (sched.length) after = Math.max(after, Math.max(...sched));
  // scan forward day by day for the first slot strictly after `after`
  const d = new Date(after);
  for (let day = 0; day < 14; day++) {
    for (const h of slots) {
      const cand = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + day, h, 0, 0);
      if (cand > after) return new Date(cand).toISOString();
    }
  }
  return new Date(after + 3600000).toISOString();
}
module.exports = { nextSlotIso, SLOTS };
```
```js
// scripts/next_slot.test.js
const test = require("node:test");
const assert = require("node:assert");
const { nextSlotIso } = require("./next_slot");

test("nextSlotIso returns the next facts slot after the latest scheduled", () => {
  const videos = [{ mode: "facts", publish_at: "2026-06-14T09:00:00Z" }];
  const now = Date.parse("2026-06-13T12:00:00Z");
  // latest scheduled is 06-14 09:00 -> next facts slot is 06-14 15:00
  assert.strictEqual(nextSlotIso(videos, "facts", now), "2026-06-14T15:00:00.000Z");
});

test("nextSlotIso with no scheduled uses next slot after now", () => {
  const now = Date.parse("2026-06-13T10:00:00Z"); // next facts slot today is 15:00
  assert.strictEqual(nextSlotIso([], "facts", now), "2026-06-13T15:00:00.000Z");
});
```

- [ ] **Step 3: Run** `node --test scripts/next_slot.test.js` → confirm FAIL then PASS after creating the file. (Write test, run FAIL, write impl, run PASS.)

- [ ] **Step 4: Commit**
```bash
git add scripts/next_slot.js scripts/next_slot.test.js
git commit -m "feat: next publish-slot computation (shared by dashboard)"
```

---

### Task 6: dashboard index.html + style.css

**Files:** Create `dashboard-site/index.html`, `dashboard-site/style.css`

- [ ] **Step 1: index.html**
```html
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>remo · Video Fabrikası</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css" />
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen">
  <div class="max-w-3xl mx-auto p-4">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-extrabold">🎬 remo · Video Fabrikası</h1>
      <span id="status" class="text-sm text-zinc-400">bağlanıyor…</span>
    </header>

    <section id="metrics" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"></section>
    <section id="channels" class="grid grid-cols-2 gap-3 mb-5"></section>

    <section class="bg-zinc-900 rounded-2xl p-4 mb-5">
      <h2 class="font-bold mb-3">🎬 Üret</h2>
      <div class="flex flex-wrap gap-3 items-center mb-3">
        <label class="flex items-center gap-2"><input type="radio" name="ch" value="facts" checked> DustMust (ilginç bilgi)</label>
        <label class="flex items-center gap-2"><input type="radio" name="ch" value="money"> Fun Honey (para)</label>
      </div>
      <input id="topic" placeholder="Konu (opsiyonel — boş bırak otomatik)" class="w-full bg-zinc-800 rounded-lg px-3 py-2 mb-3" />
      <div class="flex gap-2">
        <button id="produce" class="bg-emerald-500 text-black font-bold rounded-lg px-4 py-2">Üret ve kuyruğa ekle</button>
        <button id="settings" class="bg-zinc-700 rounded-lg px-3 py-2">⚙️ Token</button>
      </div>
      <p id="produceMsg" class="text-sm text-zinc-400 mt-2"></p>
    </section>

    <nav class="flex gap-2 mb-3">
      <button class="tab bg-zinc-800 rounded-lg px-3 py-1.5 font-semibold" data-tab="queue">Kuyruk</button>
      <button class="tab bg-zinc-800 rounded-lg px-3 py-1.5 font-semibold" data-tab="published">Yayınlananlar</button>
    </nav>
    <section id="list" class="space-y-2"></section>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: style.css**
```css
.badge { padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 700; }
.s-scheduled { background:#1e3a8a; color:#bfdbfe; }
.s-published { background:#064e3b; color:#a7f3d0; }
.s-pending   { background:#3f3f46; color:#d4d4d8; }
.s-rejected  { background:#7f1d1d; color:#fecaca; }
.tab.active { outline: 2px solid #10b981; }
```

- [ ] **Step 3: Commit**
```bash
git add dashboard-site/index.html dashboard-site/style.css
git commit -m "feat: dashboard html + styles"
```

---

### Task 7: dashboard app.js (render + produce)

**Files:** Create `dashboard-site/app.js`

- [ ] **Step 1: Implement** `dashboard-site/app.js` (embeds the same `nextSlotIso` logic from Task 5):
```js
const REPO = "admlyz5858/remo";
const DATA_URL = "dashboard.json";
const SLOTS = { facts: [9, 15], money: [11, 17] };
let DATA = null, TAB = "queue";

function nextSlotIso(videos, mode, nowMs) {
  const slots = SLOTS[mode] || [9, 15];
  const sched = (videos || []).filter((v) => v.mode === mode && v.publish_at).map((v) => Date.parse(v.publish_at)).filter((n) => !isNaN(n));
  let after = nowMs; if (sched.length) after = Math.max(after, Math.max(...sched));
  const d = new Date(after);
  for (let day = 0; day < 14; day++) for (const h of slots) {
    const c = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + day, h, 0, 0);
    if (c > after) return new Date(c).toISOString();
  }
  return new Date(after + 3600000).toISOString();
}

function fmt(iso) { return iso ? new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : ""; }
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

function render() {
  if (!DATA) return;
  const m = DATA.metrics, ch = DATA.channels;
  document.getElementById("status").textContent = "🟢 " + fmt(DATA.updated_at);
  document.getElementById("metrics").innerHTML = [
    ["Zamanlı", m.scheduled], ["Bugün", m.today], ["Yayında", m.published], ["İzlenme", (m.total_views || 0).toLocaleString("tr-TR")],
  ].map(([k, v]) => `<div class="bg-zinc-900 rounded-xl p-3"><div class="text-xs text-zinc-400">${k}</div><div class="text-xl font-extrabold">${v}</div></div>`).join("");
  document.getElementById("channels").innerHTML = Object.entries(ch).map(([mode, c]) => {
    const vids = DATA.videos.filter((v) => v.mode === mode);
    const views = vids.reduce((a, v) => a + (v.views || 0), 0);
    return `<a href="https://youtube.com/${c.handle}" target="_blank" class="rounded-xl p-3 block" style="background:${c.accent}22;border:1px solid ${c.accent}66">
      <div class="font-extrabold" style="color:${c.accent}">${c.name}</div>
      <div class="text-xs text-zinc-400">${c.niche}</div>
      <div class="text-sm mt-1">${vids.length} video · ${views.toLocaleString("tr-TR")} izlenme</div></a>`;
  }).join("");

  const vids = DATA.videos.filter((v) => TAB === "queue" ? (v.status === "scheduled" || v.status === "pending") : v.status === "published")
    .sort((a, b) => TAB === "queue" ? (Date.parse(a.publish_at || 0) - Date.parse(b.publish_at || 0)) : (b.views - a.views));
  document.getElementById("list").innerHTML = vids.map((v) => {
    const c = DATA.channels[v.mode] || {};
    const right = TAB === "queue"
      ? `<span class="badge s-${v.status}">${v.status}</span> <span class="text-xs text-zinc-400">⏰ ${fmt(v.publish_at)}</span>`
      : `<span class="text-xs">▶ ${(v.views || 0).toLocaleString("tr-TR")} · 👍 ${v.likes || 0}</span>`;
    return `<div class="bg-zinc-900 rounded-xl p-3 flex gap-3 items-center">
      <img src="${v.thumbnail}" class="w-20 h-12 object-cover rounded" onerror="this.style.visibility='hidden'"/>
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">${v.topic || v.video_id}</div>
        <div class="text-xs" style="color:${c.accent || '#aaa'}">${c.name || v.mode}</div>
        <div class="mt-1">${right} <a href="${v.url}" target="_blank" class="text-xs text-sky-400 ml-2">aç</a></div>
      </div></div>`;
  }).join("") || `<div class="text-zinc-500 text-sm">Liste boş.</div>`;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === TAB));
}

async function load() {
  try {
    const r = await fetch(DATA_URL + "?t=" + Date.now());
    if (!r.ok) throw new Error(r.status);
    DATA = await r.json(); render();
  } catch (e) {
    document.getElementById("status").textContent = "🔴 bağlanıyor… birazdan tekrar";
  }
}

document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => { TAB = t.dataset.tab; render(); }));
document.getElementById("settings").addEventListener("click", () => {
  const cur = localStorage.getItem("ghpat") || "";
  const v = prompt("GitHub PAT (remo Actions write). Sadece tarayıcında saklanır:", cur);
  if (v !== null) localStorage.setItem("ghpat", v.trim());
});
document.getElementById("produce").addEventListener("click", async () => {
  const pat = localStorage.getItem("ghpat");
  const msg = document.getElementById("produceMsg");
  if (!pat) { msg.textContent = "Önce ⚙️ ile token gir."; return; }
  const mode = document.querySelector('input[name=ch]:checked').value;
  const topic = document.getElementById("topic").value.trim();
  const publish_at = nextSlotIso(DATA ? DATA.videos : [], mode, Date.now());
  msg.textContent = "tetikleniyor…";
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/produce.yml/dispatches`, {
      method: "POST",
      headers: { Authorization: "Bearer " + pat, Accept: "application/vnd.github+json" },
      body: JSON.stringify({ ref: "master", inputs: { mode, topic, publish_at } }),
    });
    if (r.status === 204) msg.textContent = `✅ Üretiliyor (${mode}) → ${fmt(publish_at)} slotuna planlanacak. ~8 dk.`;
    else msg.textContent = "❌ Hata: " + r.status + " (token yetkisi?)";
  } catch (e) { msg.textContent = "❌ " + e.message; }
});

load();
setInterval(load, 60000);
```

- [ ] **Step 2: Structural check + commit**
Run: `node -e "const s=require('node:fs').readFileSync('dashboard-site/app.js','utf8'); ['nextSlotIso','workflows/produce.yml/dispatches','localStorage'].forEach(k=>{if(!s.includes(k))throw new Error(k)}); console.log('OK')"`
```bash
git add dashboard-site/app.js
git commit -m "feat: dashboard app.js (render + produce trigger)"
```

- [ ] **Step 3: dashboard.json skeleton** — create `dashboard-site/dashboard.json`:
```json
{ "updated_at": "", "channels": { "facts": { "name": "DustMust", "handle": "@DustMust", "niche": "İlginç bilgiler", "accent": "#FFD400" }, "money": { "name": "Fun Honey", "handle": "@FunHoney", "niche": "Para & finans", "accent": "#16C784" } }, "videos": [], "metrics": { "scheduled": 0, "published": 0, "today": 0, "total_views": 0 } }
```
Commit:
```bash
git add dashboard-site/dashboard.json
git commit -m "feat: dashboard.json skeleton"
```

---

# PHASE 3 — Deploy + verify

### Task 8: create public dashboard repo + push site + enable Pages

> Done with `gh` during execution (not a code change). Commands:

- [ ] **Step 1:** Create the public repo and push the site:
```bash
cd dashboard-site
git init -q && git add -A
git -c user.name="remo" -c user.email="admlyz5858@gmail.com" commit -q -m "init remo-dashboard"
gh repo create remo-dashboard --public --source=. --remote=origin --push
```

- [ ] **Step 2:** Enable GitHub Pages (root of default branch):
```bash
gh api -X POST repos/admlyz5858/remo-dashboard/pages -f "source[branch]=main" -f "source[path]=/" || \
gh api -X POST repos/admlyz5858/remo-dashboard/pages -f "source[branch]=master" -f "source[path]=/"
```
Expected: Pages enabled → `https://admlyz5858.github.io/remo-dashboard/`.

- [ ] **Step 3:** (User) Create the two PATs and set `DASHBOARD_DEPLOY_TOKEN` on remo:
```bash
gh secret set DASHBOARD_DEPLOY_TOKEN --repo admlyz5858/remo --body "<PAT with write to remo-dashboard>"
```
(The browser "Produce" PAT is entered in the dashboard ⚙️, not stored here.)

- [ ] **Step 4:** Trigger the first data publish + verify:
```bash
gh workflow run dashboard.yml --repo admlyz5858/remo
```
Then confirm `https://admlyz5858.github.io/remo-dashboard/dashboard.json` updates and the page shows the channels/queue.

---

### Task 9: full verification

- [ ] **Step 1:** `node --test "{pipeline,scripts}/**/*.test.js"` → all pass (build_dashboard, next_slot, topic override, existing).
- [ ] **Step 2:** `node -e "require('./pipeline/run.js'); console.log('OK')"` → OK.
- [ ] **Step 3:** Open the dashboard URL; confirm metrics, channel cards, queue/published tabs render from `dashboard.json`.
- [ ] **Step 4:** From the dashboard, set the PAT, pick a channel + topic, click Produce; confirm a new produce run starts (`gh run list`) and the video appears scheduled in the queue after it completes + dashboard refreshes.

---

## Self-Review

**Spec coverage:** §2 two-repo arch → Tasks 1,4,8. §3 dashboard.json → Task 1. §4.1 dashboard.yml → Task 4. §4.2 topic input → Tasks 2,3. §4.3 build_dashboard → Task 1. §5 UI → Tasks 6,7. §5.2 produce panel + next-slot → Tasks 5,7. §6 setup → Task 8. All covered.

**Placeholder scan:** none — concrete code/commands throughout.

**Type consistency:** `dashboard.json` shape (videos[{video_id,url,mode,topic,status,publish_at,runId,views,likes,thumbnail}], metrics, channels) consistent across build_dashboard (Task 1), app.js render (Task 7). `nextSlotIso(videos, mode, nowMs)` defined in scripts/next_slot.js (Task 5, tested) and mirrored verbatim in app.js (Task 7) — same SLOTS map. `produce.yml` inputs `mode`/`topic`/`publish_at` (Tasks 3, prior) match the app.js dispatch body (Task 7) and run.js `TOPIC` override (Tasks 2,3). `DASHBOARD_DEPLOY_TOKEN` (Task 4) set in Task 8. Channels keyed by `mode` (facts/money) consistently.
