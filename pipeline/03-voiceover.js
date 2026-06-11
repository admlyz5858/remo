const fs = require("node:fs");
const path = require("node:path");
const { readJSON, writeJSON, runPath } = require("./lib/fsx");
const { applyTimings, assembleCaptions } = require("./lib/timeline");

async function makeVoiceover({ runId, runRoot, voice, rate, deps }) {
  const scenesPath = runPath(runRoot, runId, "scenes.json");
  const doc = readJSON(scenesPath);
  const audioDir = runPath(runRoot, runId, "audio");
  fs.mkdirSync(audioDir, { recursive: true });

  const sceneFiles = [];
  const durations = [];
  const perSceneWords = [];
  for (const s of doc.scenes) {
    const out = path.join(audioDir, `scene_${String(s.id).padStart(2, "0")}.mp3`);
    const words = await deps.synth(s.narration, out, voice, rate);
    perSceneWords.push(words || []);
    durations.push(await deps.probeDuration(out));
    sceneFiles.push(out);
  }
  const finalOut = path.join(audioDir, "voiceover.mp3");
  await deps.concat(sceneFiles, finalOut);

  const timed = applyTimings(doc.scenes, durations);
  doc.scenes = timed.scenes;
  doc.total_duration_sec = timed.total_duration_sec;
  writeJSON(scenesPath, doc);

  // Captions come straight from edge-tts word boundaries (no Whisper needed).
  const startsMs = timed.scenes.map((s) => s.audio_start_ms);
  const captions = assembleCaptions(perSceneWords, startsMs);
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
