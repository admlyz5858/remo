const { writeJSON, runPath } = require("./lib/fsx");
const { recentTopics } = require("./lib/history");

const SYSTEM = "You pick one engaging MONEY & FINANCE PSYCHOLOGY topic for a 45-second English YouTube Short. Mix angles across videos: money psychology (why we overspend, scarcity mindset), rich-vs-poor mindset, or one actionable money rule (e.g. compound interest, 50/30/20). It must be visualizable with stock footage + simple charts. Educational/entertainment, NOT personalized financial advice. Respond ONLY JSON: {topic, angle, why_interesting, slug}. slug is kebab-case.";

async function pickMoneyTopic({ runId, runRoot, history, chat, override }) {
  let topic;
  if (override && String(override).trim()) {
    const t = String(override).trim();
    topic = { topic: t, angle: "", why_interesting: "", slug: t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) };
  } else {
    const avoid = recentTopics(history);
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Avoid these already-used money topics: ${JSON.stringify(avoid)}. Give one fresh, distinct money/finance topic.` },
    ];
    topic = await chat({ messages });
  }
  writeJSON(runPath(runRoot, runId, "topic.json"), topic);
  return topic;
}
module.exports = { pickMoneyTopic };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const { readJSON } = require("./lib/fsx");
  const fs = require("node:fs");
  const runId = process.env.RUN_ID; const runRoot = process.env.RUN_ROOT || "run";
  const history = fs.existsSync("state/history.json") ? readJSON("state/history.json") : { entries: [] };
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  pickMoneyTopic({ runId, runRoot, history, chat, override: process.env.TOPIC }).then((t) => console.log("money topic:", t.topic));
}
