const { readJSON, writeJSON, runPath } = require("./lib/fsx");
const { synthSegments } = require("./lib/voiceover-core");

async function makeVoiceover({ runId, runRoot, voice, rate, deps }) {
  const scenesPath = runPath(runRoot, runId, "scenes.json");
  const doc = readJSON(scenesPath);
  const audioDir = runPath(runRoot, runId, "audio");
  const segments = doc.scenes.map((s) => ({ id: s.id, narration: s.narration }));
  const { timed, captions } = await synthSegments({ segments, audioDir, voice, rate, deps });
  doc.scenes = doc.scenes.map((s, i) => ({ ...s, duration_sec: timed.scenes[i].duration_sec, audio_start_ms: timed.scenes[i].audio_start_ms, audio_end_ms: timed.scenes[i].audio_end_ms }));
  doc.total_duration_sec = timed.total_duration_sec;
  writeJSON(scenesPath, doc);
  writeJSON(runPath(runRoot, runId, "captions.json"), captions);
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
