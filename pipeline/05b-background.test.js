const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { fetchBackground } = require("./05b-background");

test("fetchBackground uses a local gameplay clip when present", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bg-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  const gp = path.join(runRoot, "gameplay"); fs.mkdirSync(gp, { recursive: true });
  fs.writeFileSync(path.join(gp, "clip.mp4"), "GP");
  const r = await fetchBackground({ runId: "r1", pubRoot, seed: "r1", gameplayDir: gp, find: async () => null, download: async () => {} });
  assert.strictEqual(r, "r1/bg.mp4");
  assert.strictEqual(fs.readFileSync(path.join(pubRoot, "r1", "bg.mp4"), "utf8"), "GP");
});

test("fetchBackground downloads stock when no gameplay clips", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bg-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  const dl = [];
  const r = await fetchBackground({ runId: "r1", pubRoot, seed: "r1", gameplayDir: path.join(runRoot, "none"),
    find: async () => ({ type: "video", url: "http://x/s.mp4", id: "1", provider: "pexelsVideo" }),
    download: async (url, dest) => { dl.push(url); fs.writeFileSync(dest, "S"); } });
  assert.strictEqual(r, "r1/bg.mp4");
  assert.deepStrictEqual(dl, ["http://x/s.mp4"]);
});
