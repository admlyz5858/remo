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
