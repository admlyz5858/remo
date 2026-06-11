const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { annotateScenes } = require("./05c-annotate");

test("annotateScenes only annotates flagged scenes and seeds type", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ann-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.mkdirSync(path.join(pubRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(pubRoot, "r1", "scene_01.mp4"), "x");
  fs.writeFileSync(path.join(runRoot, "r1", "scenes.json"), JSON.stringify({
    scenes: [
      { id: 1, narration: "n1", visual_query: "heart", annotate: true },
      { id: 2, narration: "n2", visual_query: "gills", annotate: false },
    ],
  }));
  fs.writeFileSync(path.join(runRoot, "r1", "media.json"), JSON.stringify([
    { sceneId: 1, type: "video", file: "scene_01.mp4" },
    { sceneId: 2, type: "image", file: "scene_02.jpg" },
  ]));
  const deps = {
    extractFrame: async (_m, out) => { fs.writeFileSync(out, "img"); return out; },
    detect: async () => ({ box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "heart" }),
  };
  const anns = await annotateScenes({ runId: "r1", runRoot, pubRoot, seed: "r1", deps });
  assert.strictEqual(anns.length, 1);
  assert.strictEqual(anns[0].sceneId, 1);
  assert.ok(["arrow", "circle"].includes(anns[0].type));
  assert.deepStrictEqual(anns[0].box, { x: 0.5, y: 0.4, w: 0.2, h: 0.2 });
  const written = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "annotations.json"), "utf8"));
  assert.strictEqual(written.length, 1);
});
