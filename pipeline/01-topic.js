const { writeJSON, runPath } = require("./lib/fsx");
const { recentTopics } = require("./lib/history");

const SYSTEM = "You pick one surprising, well-documented 'fun fact' suitable for a 45-second English YouTube Short. It must be easy to pair with stock footage. Respond ONLY with JSON: {topic, angle, why_interesting, slug}. slug is kebab-case.";

async function pickTopic({ runId, runRoot, history, chat, override }) {
  let topic;
  if (override && String(override).trim()) {
    const t = String(override).trim();
    topic = { topic: t, angle: "", why_interesting: "", slug: t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) };
  } else {
    const avoid = recentTopics(history);
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Avoid these already-used topics: ${JSON.stringify(avoid)}. Give one fresh, distinct topic.` },
    ];
    topic = await chat({ messages });
  }
  writeJSON(runPath(runRoot, runId, "topic.json"), topic);
  return topic;
}
module.exports = { pickTopic };

if (require.main === module) {
  const { chatJSON } = require("./lib/openrouter");
  const cfg = require("./config");
  const { readJSON } = require("./lib/fsx");
  const fs = require("node:fs");
  const runId = process.env.RUN_ID;
  const runRoot = process.env.RUN_ROOT || "run";
  const history = fs.existsSync("state/history.json") ? readJSON("state/history.json") : { entries: [] };
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });
  pickTopic({ runId, runRoot, history, chat, override: process.env.TOPIC }).then((t) => console.log("topic:", t.topic));
}
