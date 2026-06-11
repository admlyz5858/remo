const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { fetchSceneMedia } = require("./05-media");

test("fetchSceneMedia dedups within a run and falls back to alt query", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "media-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "r1", "scenes.json"), JSON.stringify({
    scenes: [
      { id: 1, visual_query: "octopus", visual_query_alt: "ocean", duration_sec: 2 },
      { id: 2, visual_query: "octopus", visual_query_alt: "coral", duration_sec: 2 },
    ],
  }));
  // Both scenes' primary query returns the SAME single candidate -> scene 2 must use its alt.
  const find = async (q) => {
    if (q === "octopus") return [{ type: "video", url: "http://x/same.mp4", id: "1", provider: "pexelsVideo" }];
    if (q === "coral") return [{ type: "image", url: "http://x/coral.jpg", id: "9", provider: "unsplash" }];
    return [];
  };
  const downloaded = [];
  const download = async (url, dest) => { downloaded.push(url); fs.writeFileSync(dest, "bin"); };
  const media = await fetchSceneMedia({ runId: "r1", runRoot, pubRoot, find, download });
  assert.strictEqual(media[0].file, "scene_01.mp4");
  assert.strictEqual(media[1].type, "image");
  assert.strictEqual(media[1].file, "scene_02.jpg");
  assert.deepStrictEqual(downloaded, ["http://x/same.mp4", "http://x/coral.jpg"]);
  const written = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "media.json"), "utf8"));
  assert.strictEqual(written.length, 2);
});
