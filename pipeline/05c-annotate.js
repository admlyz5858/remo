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
