const fs = require("node:fs");
const cfg = require("./config");
const { readJSON, writeJSON } = require("./lib/fsx");
const { isDuplicate, addEntry } = require("./lib/history");
const { chatJSON } = require("./lib/openrouter");
const { pickTopic } = require("./01-topic");
const { writeScript } = require("./02-script");
const { makeVoiceover } = require("./03-voiceover");
const { fetchSceneMedia } = require("./05-media");
const { render } = require("./06-render");
const sh = require("./lib/sh");
const providers = require("./lib/providers");
const { download } = require("./lib/download");

function pad(n) { return String(n).padStart(2, "0"); }
function makeRunId(d) {
  return `run-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

async function main() {
  const runRoot = process.env.RUN_ROOT || "run";
  const runId = process.env.RUN_ID || makeRunId(new Date());
  const historyPath = "state/history.json";
  const history = fs.existsSync(historyPath) ? readJSON(historyPath) : { entries: [] };
  const chat = (args) => chatJSON({ apiKey: process.env.OPENROUTER_API_KEY, model: cfg.model, ...args });

  let topic;
  for (let attempt = 0; attempt < 3; attempt++) {
    topic = await pickTopic({ runId, runRoot, history, chat });
    if (!isDuplicate(history, topic.slug)) break;
    console.log("duplicate topic, retrying:", topic.slug);
  }

  await writeScript({ runId, runRoot, topic, chat });

  // Voiceover also emits captions.json from edge-tts word boundaries.
  const voDeps = { synth: sh.synth, probeDuration: sh.probeDuration, concat: sh.concat };
  await makeVoiceover({ runId, runRoot, voice: cfg.voice, rate: cfg.ttsRate, deps: voDeps });

  const { findMediaCandidates } = require("./lib/stock");
  const provFns = {
    pexelsVideo: (q) => providers.pexelsVideoCandidates(q, { apiKey: process.env.PEXELS_API_KEY }),
    pixabayVideo: (q) => providers.pixabayVideoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
    pixabayPhoto: (q) => providers.pixabayPhotoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
    unsplash: (q) => providers.unsplashCandidates(q, { apiKey: process.env.UNSPLASH_API_KEY }),
  };
  const find = (q) => findMediaCandidates(q, cfg.mediaOrder, provFns);
  await fetchSceneMedia({ runId, runRoot, pubRoot: "remotion/public", find, download });

  const outFile = `out/${runId}.mp4`;
  await render({ runId, runRoot, pubRoot: "remotion/public", theme: cfg.theme, fps: cfg.render.fps, outFile });

  const nextHistory = addEntry(history, { slug: topic.slug, topic: topic.topic, status: "pending", runId });
  writeJSON(historyPath, nextHistory);
  console.log(JSON.stringify({ runId, topic: topic.topic, outFile }));
}

module.exports = { makeRunId, main };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
