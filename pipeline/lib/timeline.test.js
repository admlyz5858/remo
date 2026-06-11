const test = require("node:test");
const assert = require("node:assert");
const { applyTimings, buildInputProps } = require("./timeline");

test("applyTimings sets cumulative ms windows and total", () => {
  const scenes = [{ id: 1 }, { id: 2 }];
  const out = applyTimings(scenes, [2.0, 3.0]);
  assert.strictEqual(out.scenes[0].audio_start_ms, 0);
  assert.strictEqual(out.scenes[0].audio_end_ms, 2000);
  assert.strictEqual(out.scenes[1].audio_start_ms, 2000);
  assert.strictEqual(out.scenes[1].audio_end_ms, 5000);
  assert.strictEqual(out.total_duration_sec, 5.0);
});

test("buildInputProps converts seconds to frames and wires media", () => {
  const scenesDoc = { scenes: [
    { id: 1, on_screen_text: "A", duration_sec: 2.0 },
    { id: 2, on_screen_text: null, duration_sec: 1.0 },
  ]};
  const media = [ { sceneId: 1, type: "video", file: "scene_01.mp4" },
                  { sceneId: 2, type: "image", file: "scene_02.jpg" } ];
  const props = buildInputProps({
    runId: "r1", scenesDoc, media, captions: [{ text: "hi", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 }],
    theme: { accentColor: "#FFD400", fontFamily: "Anton", channelName: "@c" }, fps: 30,
  });
  assert.strictEqual(props.scenes[0].startFrame, 0);
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.strictEqual(props.scenes[1].startFrame, 60);
  assert.strictEqual(props.scenes[1].durationFrames, 30);
  assert.strictEqual(props.scenes[0].media.src, "r1/scene_01.mp4");
  assert.strictEqual(props.audioSrc, "r1/voiceover.mp3");
  assert.strictEqual(props.scenes[0].onScreenText, "A");
});
