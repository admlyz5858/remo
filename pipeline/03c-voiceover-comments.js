const { readJSON, writeJSON, runPath } = require("./lib/fsx");
const { synthSegments } = require("./lib/voiceover-core");

async function makeCommentsVoiceover({ runId, runRoot, voice, rate, deps }) {
  const deck = readJSON(runPath(runRoot, runId, "deck.json"));
  const CTA = "Comment your favorite below, and follow for more!";
  const segments = [
    { id: 1, narration: deck.question, kind: "question", author: null, upvotes: null, text: deck.question },
    ...deck.comments.map((c, i) => ({ id: i + 2, narration: c.text, kind: "comment", author: c.author, upvotes: c.upvotes, text: c.text })),
    { id: deck.comments.length + 2, narration: CTA, kind: "cta", author: null, upvotes: null, text: CTA },
  ];
  const audioDir = runPath(runRoot, runId, "audio");
  const { timed, captions } = await synthSegments({ segments, audioDir, voice, rate, deps });
  deck.segments = segments.map((s, i) => ({
    kind: s.kind, author: s.author, upvotes: s.upvotes, text: s.text,
    duration_sec: timed.scenes[i].duration_sec, audio_start_ms: timed.scenes[i].audio_start_ms, audio_end_ms: timed.scenes[i].audio_end_ms,
  }));
  deck.total_duration_sec = timed.total_duration_sec;
  writeJSON(runPath(runRoot, runId, "deck.json"), deck);
  writeJSON(runPath(runRoot, runId, "captions.json"), captions);
  return deck;
}
module.exports = { makeCommentsVoiceover };

if (require.main === module) {
  const cfg = require("./config");
  const sh = require("./lib/sh");
  const deps = { synth: sh.synth, probeDuration: sh.probeDuration, concat: sh.concat };
  makeCommentsVoiceover({ runId: process.env.RUN_ID, runRoot: process.env.RUN_ROOT || "run", voice: cfg.voice, rate: cfg.ttsRate, deps })
    .then((d) => console.log("comments sec:", d.total_duration_sec));
}
