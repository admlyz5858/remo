const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { pickTopic } = require("./01-topic");

test("pickTopic asks model avoiding recent topics and writes topic.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "topic-"));
  const history = { entries: [{ slug: "honey-never-spoils", topic: "Honey never spoils", status: "published" }] };
  let seenMessages;
  const fakeChat = async ({ messages }) => { seenMessages = messages; return { topic: "Octopus hearts", angle: "biology", why_interesting: "three hearts", slug: "octopus-three-hearts" }; };
  const result = await pickTopic({ runId: "r1", runRoot, history, chat: fakeChat });
  assert.match(JSON.stringify(seenMessages), /Honey never spoils/);
  assert.strictEqual(result.slug, "octopus-three-hearts");
  const written = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "topic.json"), "utf8"));
  assert.strictEqual(written.topic, "Octopus hearts");
});

test("pickTopic with override skips the model and uses the given topic", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ovr-"));
  let called = false;
  const chat = async () => { called = true; return {}; };
  const r = await pickTopic({ runId: "r1", runRoot, history: { entries: [] }, chat, override: "Why cats purr" });
  assert.strictEqual(called, false);
  assert.strictEqual(r.topic, "Why cats purr");
  assert.strictEqual(r.slug, "why-cats-purr");
  const w = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "topic.json"), "utf8"));
  assert.strictEqual(w.topic, "Why cats purr");
});
