const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { writeScript } = require("./02-script");

test("writeScript persists scenes.json and meta.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "script-"));
  const topic = { topic: "Octopus hearts", angle: "biology", why_interesting: "three hearts", slug: "octopus-three-hearts" };
  const fakeChat = async () => ({
    hook: "Octopuses have THREE hearts.",
    cta: "Follow for more.",
    scenes: [{ id: 1, narration: "Octopuses have three hearts.", visual_query: "octopus ocean", on_screen_text: "3 HEARTS" }],
    title: "Why Octopuses Have 3 Hearts #shorts",
    description: "A quick fact.",
    tags: ["octopus", "shorts"],
  });
  const r = await writeScript({ runId: "r1", runRoot, topic, chat: fakeChat });
  const scenes = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "scenes.json"), "utf8"));
  const meta = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "meta.json"), "utf8"));
  assert.strictEqual(scenes.scenes[0].visual_query, "octopus ocean");
  assert.strictEqual(scenes.audio_path, "audio/voiceover.mp3");
  assert.match(meta.title, /Octopuses/);
  assert.ok(meta.tags.includes("shorts"));
  assert.strictEqual(r.scenes.scenes.length, 1);
});
