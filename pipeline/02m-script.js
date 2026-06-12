const { writeJSON, runPath } = require("./lib/fsx");

const SYSTEM = `You are a YouTube Shorts scriptwriter for a MONEY & FINANCE PSYCHOLOGY channel. Write a ~50 second English voiceover, 5-6 scenes (100-115 words total, under 60s). Engagement structure:
- Scene 1 narration OPENS with a curiosity/guess question.
- A "wait for it" bridge in the middle.
- The LAST scene narration delivers the payoff + a call to action (comment + follow).
Educational/entertainment, NOT personalized financial advice.
Respond ONLY JSON: {hook, hook_question, wait_teaser, payoff, cta, scenes:[{id, narration, visual_query, visual_query_alt, on_screen_text, emoji, annotate, stat, chart}], title, description, tags}.
- stat: a key number to animate as {value, label} where value is a short money/number string like "$1,000,000" or "340%" and label is 2-4 words; or null. Put a stat on 1-2 scenes.
- chart: a rising trend as an array of 3-6 increasing numbers (e.g. [10,30,55,100]); or null. Put a chart on the scene that shows growth.
- visual_query: 2-4 English words, money/business/finance footage. visual_query_alt: a different backup.
- on_screen_text: short punchy caption or null. emoji: ONE relevant money emoji or null. annotate: usually false.
- title <= 90 chars ending with " #shorts". tags 10-20 incl "money","finance","investing","shorts".`;

async function writeMoneyScript({ runId, runRoot, topic, chat }) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Topic: ${topic.topic}\nAngle: ${topic.angle}\nWhy interesting: ${topic.why_interesting}` },
  ];
  const out = await chat({ messages });
  const scenes = {
    hook: out.hook, cta: out.cta,
    hook_question: out.hook_question || null,
    wait_teaser: out.wait_teaser || null,
    payoff: out.payoff || null,
    audio_path: "audio/voiceover.mp3", total_duration_sec: 0,
    scenes: out.scenes.map((s) => ({
      id: s.id, narration: s.narration,
      visual_query: s.visual_query, visual_query_alt: s.visual_query_alt || null,
      on_screen_text: s.on_screen_text || null, emoji: s.emoji || null, annotate: !!s.annotate,
      stat: s.stat && s.stat.value ? { value: String(s.stat.value), label: String(s.stat.label || "") } : null,
      chart: Array.isArray(s.chart) && s.chart.length >= 2 ? s.chart.map(Number) : null,
      duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0,
    })),
  };
  const DISCLAIMER = "\n\n⚠️ Educational and entertainment only — not financial advice.";
  const desc = (out.description || "") + DISCLAIMER;
  const meta = { title: out.title, description: desc, tags: out.tags, category_id: 25 };
  writeJSON(runPath(runRoot, runId, "scenes.json"), scenes);
  writeJSON(runPath(runRoot, runId, "meta.json"), meta);
  return { scenes, meta };
}
module.exports = { writeMoneyScript };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const { readJSON, runPath } = require("./lib/fsx");
  const runId = process.env.RUN_ID; const runRoot = process.env.RUN_ROOT || "run";
  const topic = readJSON(runPath(runRoot, runId, "topic.json"));
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  writeMoneyScript({ runId, runRoot, topic, chat }).then((r) => console.log("scenes:", r.scenes.scenes.length));
}
