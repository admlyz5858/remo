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
