const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { pickMoneyTopic } = require("./01m-topic");

test("pickMoneyTopic with override skips the model and uses the given topic", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "movr-"));
  let called = false;
  const chat = async () => { called = true; return {}; };
  const r = await pickMoneyTopic({ runId: "r1", runRoot, history: { entries: [] }, chat, override: "Compound interest basics" });
  assert.strictEqual(called, false);
  assert.strictEqual(r.topic, "Compound interest basics");
  assert.strictEqual(r.slug, "compound-interest-basics");
  const w = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "topic.json"), "utf8"));
  assert.strictEqual(w.topic, "Compound interest basics");
});

test("pickMoneyTopic without override asks the model avoiding recent topics", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mllm-"));
  const history = { entries: [{ slug: "fifty-thirty-twenty", topic: "50/30/20 rule", status: "published" }] };
  let seenMessages;
  const fakeChat = async ({ messages }) => { seenMessages = messages; return { topic: "Scarcity mindset", angle: "psychology", why_interesting: "drives overspending", slug: "scarcity-mindset" }; };
  const result = await pickMoneyTopic({ runId: "r1", runRoot, history, chat: fakeChat });
  assert.match(JSON.stringify(seenMessages), /50\/30\/20 rule/);
  assert.match(JSON.stringify(seenMessages), /money|finance/i);
  assert.strictEqual(result.slug, "scarcity-mindset");
});
