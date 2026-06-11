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
