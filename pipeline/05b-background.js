const fs = require("node:fs");
const path = require("node:path");
const { pickFrom } = require("./lib/seed");

const QUERIES = ["satisfying loop", "abstract flowing", "oddly satisfying", "calm waves", "neon motion"];

// find(query)->candidate|null (single best); download(url,dest)
async function fetchBackground({ runId, pubRoot, seed, gameplayDir, find, download }) {
  const dest = path.join(pubRoot, runId, "bg.mp4");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    if (gameplayDir && fs.existsSync(gameplayDir)) {
      const clips = fs.readdirSync(gameplayDir).filter((f) => /\.(mp4|webm|mov)$/i.test(f));
      if (clips.length) {
        fs.copyFileSync(path.join(gameplayDir, pickFrom(seed, clips)), dest);
        return `${runId}/bg.mp4`;
      }
    }
  } catch (_) { /* fall through to stock */ }
  const hit = await find(pickFrom(`${seed}:bg`, QUERIES));
  if (!hit) throw new Error("no background clip available");
  await download(hit.url, dest);
  return `${runId}/bg.mp4`;
}
module.exports = { fetchBackground };

if (require.main === module) {
  const cfg = require("./config");
  const { findMediaCandidates } = require("./lib/stock");
  const providers = require("./lib/providers");
  const { download } = require("./lib/download");
  const provFns = {
    pexelsVideo: (q) => providers.pexelsVideoCandidates(q, { apiKey: process.env.PEXELS_API_KEY }),
    pixabayVideo: (q) => providers.pixabayVideoCandidates(q, { apiKey: process.env.PIXABAY_API_KEY }),
  };
  const find = async (q) => (await findMediaCandidates(q, ["pexelsVideo", "pixabayVideo"], provFns))[0] || null;
  fetchBackground({ runId: process.env.RUN_ID, pubRoot: "remotion/public", seed: process.env.RUN_ID, gameplayDir: cfg.gameplay.dir, find, download })
    .then((s) => console.log("bg:", s));
}
