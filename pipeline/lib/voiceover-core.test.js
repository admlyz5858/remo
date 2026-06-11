const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { synthSegments } = require("./voiceover-core");

test("synthSegments synths each segment, concats, returns timings + captions", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-"));
  const synthed = [];
  const deps = {
    synth: async (text, out) => { synthed.push(text); fs.writeFileSync(out, "x"); return [{ text, offsetMs: 100, durationMs: 200 }]; },
    probeDuration: async () => 2.0,
    concat: async (_f, out) => fs.writeFileSync(out, "joined"),
  };
  const r = await synthSegments({ segments: [{ id: 1, narration: "one" }, { id: 2, narration: "two" }], audioDir: dir, voice: "v", rate: "+8%", deps });
  assert.deepStrictEqual(synthed, ["one", "two"]);
  assert.strictEqual(r.durations.length, 2);
  assert.strictEqual(r.timed.total_duration_sec, 4.0);
  assert.strictEqual(r.timed.scenes[1].audio_start_ms, 2000);
  assert.strictEqual(r.captions.length, 2);
  assert.deepStrictEqual(r.captions[0], { text: "one", startMs: 100, endMs: 300, timestampMs: 200, confidence: 1 });
  assert.ok(fs.existsSync(path.join(dir, "voiceover.mp3")));
});
