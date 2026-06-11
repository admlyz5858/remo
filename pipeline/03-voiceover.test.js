const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { makeVoiceover } = require("./03-voiceover");

test("makeVoiceover synthesizes each scene, concats, writes timings", async () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vo-"));
  const dir = path.join(runRoot, "r1"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "scenes.json"), JSON.stringify({
    hook: "h", cta: "c", audio_path: "audio/voiceover.mp3", total_duration_sec: 0,
    scenes: [
      { id: 1, narration: "one", visual_query: "q", on_screen_text: null, duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0 },
      { id: 2, narration: "two", visual_query: "q", on_screen_text: null, duration_sec: 0, audio_start_ms: 0, audio_end_ms: 0 },
    ],
  }));
  const synthed = [];
  const deps = {
    synth: async (text, out) => {
      synthed.push(text);
      fs.writeFileSync(out, "x");
      return [{ text, offsetMs: 100, durationMs: 300 }];
    },
    probeDuration: async () => 2.5,
    concat: async (_files, out) => fs.writeFileSync(out, "joined"),
  };
  const r = await makeVoiceover({ runId: "r1", runRoot, voice: "v", rate: "+8%", deps });
  assert.deepStrictEqual(synthed, ["one", "two"]);
  const scenes = JSON.parse(fs.readFileSync(path.join(dir, "scenes.json"), "utf8"));
  assert.strictEqual(scenes.scenes[1].audio_start_ms, 2500);
  assert.strictEqual(scenes.total_duration_sec, 5.0);
  assert.ok(fs.existsSync(path.join(dir, "audio", "voiceover.mp3")));
  assert.strictEqual(r.total_duration_sec, 5.0);

  // captions.json assembled from edge-tts word boundaries, offset per scene
  const caps = JSON.parse(fs.readFileSync(path.join(dir, "captions.json"), "utf8"));
  assert.strictEqual(caps.length, 2);
  assert.deepStrictEqual(caps[0], { text: "one", startMs: 100, endMs: 400, timestampMs: 250, confidence: 1 });
  assert.deepStrictEqual(caps[1], { text: "two", startMs: 2600, endMs: 2900, timestampMs: 2750, confidence: 1 });
});
