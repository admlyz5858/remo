const test = require("node:test");
const assert = require("node:assert");
const { applyTimings, buildInputProps, assembleCaptions } = require("./timeline");

test("applyTimings sets cumulative ms windows and total", () => {
  const scenes = [{ id: 1 }, { id: 2 }];
  const out = applyTimings(scenes, [2.0, 3.0]);
  assert.strictEqual(out.scenes[0].audio_start_ms, 0);
  assert.strictEqual(out.scenes[0].audio_end_ms, 2000);
  assert.strictEqual(out.scenes[1].audio_start_ms, 2000);
  assert.strictEqual(out.scenes[1].audio_end_ms, 5000);
  assert.strictEqual(out.total_duration_sec, 5.0);
});

test("buildInputProps converts frames, seeds accent + transition, wires music", () => {
  const scenesDoc = { scenes: [
    { id: 1, on_screen_text: "A", duration_sec: 2.0 },
    { id: 2, on_screen_text: null, duration_sec: 1.0 },
  ]};
  const media = [ { sceneId: 1, type: "video", file: "scene_01.mp4" },
                  { sceneId: 2, type: "image", file: "scene_02.jpg" } ];
  const transitions = ["slideLeft", "slideUp", "zoomIn", "fade"];
  const accentPalette = ["#111111", "#222222", "#333333"];
  const props = buildInputProps({
    runId: "r1", scenesDoc, media,
    captions: [{ text: "hi", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 }],
    theme: { accentColor: "#000000", fontFamily: "Anton", channelName: "@c" },
    fps: 30, seed: "r1", accentPalette, transitions, musicSrc: "r1/music.mp3", musicVolume: 0.1,
  });
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.strictEqual(props.scenes[1].startFrame, 60);
  assert.strictEqual(props.scenes[0].media.src, "r1/scene_01.mp4");
  assert.strictEqual(props.audioSrc, "r1/voiceover.mp3");
  assert.strictEqual(props.musicSrc, "r1/music.mp3");
  assert.strictEqual(props.musicVolume, 0.1);
  assert.ok(accentPalette.includes(props.theme.accentColor));
  assert.ok(transitions.includes(props.scenes[0].transition));
});

test("assembleCaptions offsets per-scene word boundaries by scene start", () => {
  const perScene = [
    [{ text: "one", offsetMs: 0, durationMs: 400 }, { text: "two", offsetMs: 400, durationMs: 600 }],
    [{ text: "three", offsetMs: 0, durationMs: 500 }],
  ];
  const startsMs = [0, 2000];
  const caps = assembleCaptions(perScene, startsMs);
  assert.strictEqual(caps.length, 3);
  assert.deepStrictEqual(caps[0], { text: "one", startMs: 0, endMs: 400, timestampMs: 200, confidence: 1 });
  assert.deepStrictEqual(caps[1], { text: "two", startMs: 400, endMs: 1000, timestampMs: 700, confidence: 1 });
  assert.deepStrictEqual(caps[2], { text: "three", startMs: 2000, endMs: 2500, timestampMs: 2250, confidence: 1 });
});
