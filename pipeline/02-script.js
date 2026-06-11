const { writeJSON, runPath } = require("./lib/fsx");

const SYSTEM = `You are a YouTube Shorts scriptwriter. Write a ~50 second English voiceover. This is CRITICAL: the total narration MUST be 100-115 words across EXACTLY 5-6 scenes (a 12-second video is a FAILURE; staying under 60 seconds is REQUIRED). Each scene's narration is about 2 sentences (~17-20 words). Structure:
- Scene 1 narration OPENS with a curiosity/guess question, then starts explaining.
- Middle scenes build the story with concrete details, facts, and one "wait for it" bridge.
- The LAST scene narration delivers the payoff (answer) and a call to action (ask viewers to comment + follow).
Rules: 2nd person, vivid punchy sentences, numbers spelled where it helps TTS. Do NOT be terse — fill each scene with real substance.
Respond ONLY JSON: {hook, hook_question, wait_teaser, payoff, cta, scenes:[{id, narration, visual_query, visual_query_alt, on_screen_text, emoji, annotate}], title, description, tags}.
- hook_question: short on-screen guess question. wait_teaser: short "wait for it" line. payoff: short answer line. cta: short comment+follow line.
- Each scene visual_query MUST be DISTINCT and specific (2-4 English words for a concrete filmable shot, e.g. "octopus gills macro"). visual_query_alt: a different backup query.
- on_screen_text: short punchy caption or null. emoji: ONE relevant emoji or null. annotate: true for exactly 1-2 MIDDLE/content scenes (NOT scene 1, NOT the last scene) that show a concrete object worth pointing at; false otherwise.
- title <= 90 chars ending with " #shorts". tags = 10-20 strings including "shorts".`;

async function writeScript({ runId, runRoot, topic, chat }) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Topic: ${topic.topic}\nAngle: ${topic.angle}\nWhy interesting: ${topic.why_interesting}` },
  ];
  const out = await chat({ messages });
  const scenes = {
    hook: out.hook,
    cta: out.cta,
    hook_question: out.hook_question || null,
    wait_teaser: out.wait_teaser || null,
    payoff: out.payoff || null,
    audio_path: "audio/voiceover.mp3",
    total_duration_sec: 0,
    scenes: out.scenes.map((s) => ({
      id: s.id, narration: s.narration,
      visual_query: s.visual_query,
      visual_query_alt: s.visual_query_alt || null,
      on_screen_text: s.on_screen_text || null,
      emoji: s.emoji || null,
      annotate: !!s.annotate,
      duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0,
    })),
  };
  const meta = { title: out.title, description: out.description, tags: out.tags, category_id: 27 };
  writeJSON(runPath(runRoot, runId, "scenes.json"), scenes);
  writeJSON(runPath(runRoot, runId, "meta.json"), meta);
  return { scenes, meta };
}
module.exports = { writeScript };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const { readJSON, runPath } = require("./lib/fsx");
  const runId = process.env.RUN_ID; const runRoot = process.env.RUN_ROOT || "run";
  const topic = readJSON(runPath(runRoot, runId, "topic.json"));
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  writeScript({ runId, runRoot, topic, chat }).then((r) => console.log("scenes:", r.scenes.scenes.length));
}
