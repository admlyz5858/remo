const { writeJSON, runPath } = require("./lib/fsx");

const SYSTEM = `You are a YouTube Shorts scriptwriter. Write a 40-50 second English voiceover, 3-6 scenes.
Rules: 2nd person, short sentences, strong hook in scene 1, numbers spelled where it helps TTS.
Respond ONLY JSON: {hook, cta, scenes:[{id, narration, visual_query, on_screen_text}], title, description, tags}.
visual_query = 2-4 English words for stock search. on_screen_text = short caption or null. title <= 90 chars and ends with " #shorts". tags = 10-20 strings including "shorts".`;

async function writeScript({ runId, runRoot, topic, chat }) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Topic: ${topic.topic}\nAngle: ${topic.angle}\nWhy interesting: ${topic.why_interesting}` },
  ];
  const out = await chat({ messages });
  const scenes = {
    hook: out.hook,
    cta: out.cta,
    audio_path: "audio/voiceover.mp3",
    total_duration_sec: 0,
    scenes: out.scenes.map((s) => ({
      id: s.id, narration: s.narration, visual_query: s.visual_query,
      on_screen_text: s.on_screen_text || null,
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
