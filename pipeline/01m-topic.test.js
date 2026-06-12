const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { pickMoneyTopic } = require("./01m-topic");

test("pickMoneyTopic asks model avoiding recent topics and writes topic.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mtopic-"));
  const history = { entries: [{ slug: "compound-interest", topic: "Compound interest", status: "published", mode: "money" }] };
  let seen;
  const fakeChat = async ({ messages }) => { seen = messages; return { topic: "Why you overspend", angle: "money psychology", why_interesting: "scarcity mindset", slug: "why-you-overspend" }; };
  const result = await pickMoneyTopic({ runId: "r1", runRoot, history, chat: fakeChat });
  assert.match(JSON.stringify(seen), /Compound interest/);
  assert.match(JSON.stringify(seen), /money|finance/i);
  assert.strictEqual(result.slug, "why-you-overspend");
  const w = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "topic.json"), "utf8"));
  assert.strictEqual(w.topic, "Why you overspend");
});
