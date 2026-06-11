const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { prepareRender } = require("./06-render");

test("prepareRender copies audio into public and builds props with frames", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rnd-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpub-"));
  const dir = path.join(runRoot, "r1"); fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.mkdirSync(path.join(pubRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(dir, "audio", "voiceover.mp3"), "AUDIO");
  fs.writeFileSync(path.join(dir, "scenes.json"), JSON.stringify({
    scenes: [{ id: 1, on_screen_text: "A", duration_sec: 2.0 }], total_duration_sec: 2.0,
  }));
  fs.writeFileSync(path.join(dir, "media.json"), JSON.stringify([{ sceneId: 1, type: "video", file: "scene_01.mp4" }]));
  fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify([{ text: "hi", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 }]));

  const props = prepareRender({ runId: "r1", runRoot, pubRoot, theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@c" }, fps: 30 });
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.strictEqual(props.audioSrc, "r1/voiceover.mp3");
  assert.strictEqual(fs.readFileSync(path.join(pubRoot, "r1", "voiceover.mp3"), "utf8"), "AUDIO");
});
