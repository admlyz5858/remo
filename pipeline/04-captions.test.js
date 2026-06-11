const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { makeCaptions } = require("./04-captions");

test("makeCaptions calls transcriber with audio + out paths", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cap-"));
  const dir = path.join(runRoot, "r1", "audio"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "voiceover.mp3"), "x");
  let args;
  const transcribe = async (audio, out) => { args = { audio, out }; fs.writeFileSync(out, JSON.stringify([{ text: "hi", startMs: 0, endMs: 1, timestampMs: 0, confidence: 1 }])); };
  const caps = await makeCaptions({ runId: "r1", runRoot, transcribe });
  assert.match(args.audio, /voiceover\.mp3$/);
  assert.match(args.out, /captions\.json$/);
  assert.strictEqual(caps[0].text, "hi");
});
