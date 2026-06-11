const fs = require("node:fs");
const path = require("node:path");
const { readJSON, writeJSON, runPath } = require("./lib/fsx");
const { buildInputProps } = require("./lib/timeline");
const { pickMusic } = require("./lib/seed");

const MUSIC_CREDIT =
  "Music: Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/)";

// CC-BY requires crediting the track in the description; append once (idempotent).
function appendMusicCredit(runRoot, runId) {
  const metaPath = runPath(runRoot, runId, "meta.json");
  if (!fs.existsSync(metaPath)) return;
  const meta = readJSON(metaPath);
  const desc = meta.description || "";
  if (desc.includes("incompetech")) return;
  meta.description = `${desc}\n\n${MUSIC_CREDIT}`.trim();
  writeJSON(metaPath, meta);
}

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
        appendMusicCredit(runRoot, runId);
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
