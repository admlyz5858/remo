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
