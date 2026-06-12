const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { makeCommentsVoiceover } = require("./03c-voiceover-comments");

test("makeCommentsVoiceover voices question+comments, writes timed deck + captions", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cvo-"));
  fs.mkdirSync(path.join(runRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "r1", "deck.json"), JSON.stringify({
    subreddit: "AskReddit", question: "What is best?",
    comments: [{ id: 1, author: "u/a", text: "one", upvotes: "1k" }, { id: 2, author: "u/b", text: "two", upvotes: "2k" }],
  }));
  const deps = {
    synth: async (_t, out) => { fs.writeFileSync(out, "x"); return [{ text: "w", offsetMs: 0, durationMs: 100 }]; },
    probeDuration: async () => 1.5,
    concat: async (_f, out) => fs.writeFileSync(out, "j"),
  };
  const deck = await makeCommentsVoiceover({ runId: "r1", runRoot, voice: "v", rate: "+8%", deps });
  // question + 2 comments + cta = 4 segments
  assert.strictEqual(deck.total_duration_sec, 6.0);
  assert.strictEqual(deck.segments.length, 4);
  assert.strictEqual(deck.segments[0].kind, "question");
  assert.strictEqual(deck.segments[1].kind, "comment");
  assert.strictEqual(deck.segments[3].kind, "cta");
  assert.ok(fs.existsSync(path.join(runRoot, "r1", "captions.json")));
  assert.ok(fs.existsSync(path.join(runRoot, "r1", "audio", "voiceover.mp3")));
});
