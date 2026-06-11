const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { fetchSceneMedia } = require("./05-media");

test("fetchSceneMedia finds + downloads media per scene and writes media.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "media-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "r1", "scenes.json"), JSON.stringify({
    scenes: [
      { id: 1, visual_query: "octopus", duration_sec: 2 },
      { id: 2, visual_query: "coral", duration_sec: 2 },
    ],
  }));
  const find = async (q) => ({ type: q === "octopus" ? "video" : "image", url: `http://x/${q}`, provider: "pexels" });
  const downloaded = [];
  const download = async (url, dest) => { downloaded.push({ url, dest }); fs.writeFileSync(dest, "bin"); };
  const media = await fetchSceneMedia({ runId: "r1", runRoot, pubRoot, find, download });
  assert.strictEqual(media[0].type, "video");
  assert.strictEqual(media[0].file, "scene_01.mp4");
  assert.strictEqual(media[1].file, "scene_02.jpg");
  assert.ok(fs.existsSync(path.join(pubRoot, "r1", "scene_01.mp4")));
  const written = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "media.json"), "utf8"));
  assert.strictEqual(written.length, 2);
});
