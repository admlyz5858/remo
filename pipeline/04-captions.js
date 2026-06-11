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
