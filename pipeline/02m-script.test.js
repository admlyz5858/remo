const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { writeMoneyScript } = require("./02m-script");

test("writeMoneyScript persists scenes (stat/chart) + meta with disclaimer", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mscript-"));
  const topic = { topic: "Compound interest", angle: "rule", why_interesting: "growth", slug: "compound-interest" };
  const fakeChat = async () => ({
    hook: "Money doubles.", hook_question: "Guess how fast money grows?", wait_teaser: "Wait for the number.", payoff: "It compounds!",
    cta: "Follow for money tips.",
    scenes: [
      { id: 1, narration: "Compound interest grows your money.", visual_query: "stock chart rising", visual_query_alt: "cash", on_screen_text: "COMPOUND", emoji: "💰", annotate: false, stat: { value: "$1,000,000", label: "by 65" }, chart: [10, 30, 55, 100] },
      { id: 2, narration: "Start early.", visual_query: "piggy bank", visual_query_alt: "savings", on_screen_text: null, emoji: "🏦", annotate: false, stat: null, chart: null },
    ],
    title: "How Money Doubles #shorts", description: "A money rule.", tags: ["money", "finance", "shorts"],
  });
  const r = await writeMoneyScript({ runId: "r1", runRoot, topic, chat: fakeChat });
  const scenes = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "scenes.json"), "utf8"));
  const meta = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "meta.json"), "utf8"));
  assert.deepStrictEqual(scenes.scenes[0].stat, { value: "$1,000,000", label: "by 65" });
  assert.deepStrictEqual(scenes.scenes[0].chart, [10, 30, 55, 100]);
  assert.strictEqual(scenes.scenes[1].stat, null);
  assert.match(meta.description, /not financial advice/i);
  assert.ok(meta.tags.includes("shorts"));
  assert.strictEqual(r.scenes.scenes.length, 2);
});
