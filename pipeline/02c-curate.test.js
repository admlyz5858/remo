const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { curateDeck } = require("./02c-curate");

test("curateDeck persists deck.json + meta.json from the LLM result", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cur-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "r1", "raw_deck.json"), JSON.stringify({
    subreddit: "AskReddit", postId: "p1", question: "What is best?",
    comments: [{ author: "a", text: "clean joke", score: 1234 }, { author: "b", text: "bad", score: 1 }],
  }));
  const fakeChat = async () => ({
    question: "What is best?",
    comments: [{ id: 1, author: "u/a", text: "clean joke", upvotes: "1.2k" }],
    title: "Funniest Reddit answers #shorts",
    description: "d", tags: ["reddit", "shorts"],
  });
  const deck = await curateDeck({ runId: "r1", runRoot, chat: fakeChat });
  assert.strictEqual(deck.comments.length, 1);
  const d = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "deck.json"), "utf8"));
  const m = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "meta.json"), "utf8"));
  assert.strictEqual(d.question, "What is best?");
  assert.strictEqual(d.subreddit, "AskReddit");
  assert.ok(m.tags.includes("shorts"));
});
