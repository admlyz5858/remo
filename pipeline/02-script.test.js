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
    hook_question: "Which has 3 hearts — octopus or squid?",
    wait_teaser: "But the weird part is next.",
    payoff: "Yep — octopuses have three hearts!",
    scenes: [
      { id: 1, narration: "Octopuses have three hearts.", visual_query: "octopus closeup", visual_query_alt: "deep ocean", on_screen_text: "3 HEARTS", emoji: "🐙", annotate: true },
      { id: 2, narration: "Two pump blood to the gills.", visual_query: "octopus gills macro", visual_query_alt: "octopus swimming", on_screen_text: null, emoji: "❤️", annotate: false },
    ],
    title: "Why Octopuses Have 3 Hearts #shorts",
    description: "A quick fact.",
    tags: ["octopus", "shorts"],
  });
  const r = await writeScript({ runId: "r1", runRoot, topic, chat: fakeChat });
  const scenes = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "scenes.json"), "utf8"));
  const meta = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "meta.json"), "utf8"));
  assert.strictEqual(scenes.scenes[0].visual_query, "octopus closeup");
  assert.strictEqual(scenes.scenes[0].visual_query_alt, "deep ocean");
  assert.strictEqual(scenes.audio_path, "audio/voiceover.mp3");
  assert.match(meta.title, /Octopuses/);
  assert.ok(meta.tags.includes("shorts"));
  assert.strictEqual(r.scenes.scenes.length, 2);
  assert.strictEqual(scenes.hook_question, "Which has 3 hearts — octopus or squid?");
  assert.strictEqual(scenes.wait_teaser, "But the weird part is next.");
  assert.strictEqual(scenes.payoff, "Yep — octopuses have three hearts!");
  assert.strictEqual(scenes.scenes[0].emoji, "🐙");
  assert.strictEqual(scenes.scenes[0].annotate, true);
  assert.strictEqual(scenes.scenes[1].annotate, false);
});
