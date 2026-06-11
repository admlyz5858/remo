const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { fetchRawDeck } = require("./01c-comments");

test("fetchRawDeck picks a subreddit by seed, gathers comments, writes raw_deck.json", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cm-"));
  const deps = {
    getPost: async (sub) => ({ id: "p1", subreddit: sub, title: "What is best?" }),
    getComments: async () => [
      { author: "a", text: "one", score: 10 },
      { author: "b", text: "two", score: 99 },
    ],
  };
  const raw = await fetchRawDeck({ runId: "r1", runRoot, seed: "r1", subreddits: ["AskReddit", "tifu"], deps });
  assert.strictEqual(raw.question, "What is best?");
  assert.strictEqual(raw.comments.length, 2);
  const w = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "raw_deck.json"), "utf8"));
  assert.strictEqual(w.subreddit, raw.subreddit);
});
