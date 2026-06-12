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

test("buildInputProps emits hooks, emoji, annotation + sfx", () => {
  const scenesDoc = {
    hook_question: "Guess?", wait_teaser: "Wait...", payoff: "Answer!",
    cta: "Comment + follow",
    scenes: [
      { id: 1, on_screen_text: "A", duration_sec: 2.0, emoji: "🐙" },
      { id: 2, on_screen_text: null, duration_sec: 1.0, emoji: null },
    ],
  };
  const media = [ { sceneId: 1, type: "video", file: "scene_01.mp4" },
                  { sceneId: 2, type: "image", file: "scene_02.jpg" } ];
  const annotations = [{ sceneId: 1, box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "heart", type: "circle" }];
  const props = buildInputProps({
    runId: "r1", scenesDoc, media, captions: [],
    theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@c" },
    fps: 30, seed: "r1", accentPalette: ["#111", "#222"], transitions: ["slideLeft", "fade"],
    musicSrc: "r1/music.mp3", musicVolume: 0.1, annotations, sfxSrc: "r1/sfx.mp3",
  });
  assert.strictEqual(props.hookQuestion, "Guess?");
  assert.strictEqual(props.waitTeaser, "Wait...");
  assert.strictEqual(props.payoff, "Answer!");
  assert.strictEqual(props.cta, "Comment + follow");
  assert.strictEqual(props.sfxSrc, "r1/sfx.mp3");
  assert.strictEqual(props.scenes[0].emoji, "🐙");
  assert.strictEqual(props.scenes[1].emoji, null);
  assert.deepStrictEqual(props.scenes[0].annotation, { box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "heart", type: "circle" });
  assert.strictEqual(props.scenes[1].annotation, null);
});

test("buildInputProps defaults annotations/sfx when omitted", () => {
  const scenesDoc = { scenes: [{ id: 1, on_screen_text: null, duration_sec: 1.0 }] };
  const props = buildInputProps({
    runId: "r1", scenesDoc, media: [], captions: [],
    theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@c" },
    fps: 30, seed: "r1", accentPalette: ["#111"], transitions: ["fade"],
  });
  assert.strictEqual(props.sfxSrc, null);
  assert.strictEqual(props.scenes[0].annotation, null);
  assert.strictEqual(props.hookQuestion, null);
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

const { buildCommentsProps, parseUpvotes } = require("./timeline");

test("parseUpvotes parses human strings to numbers", () => {
  assert.strictEqual(parseUpvotes("12.4k"), 12400);
  assert.strictEqual(parseUpvotes("999"), 999);
  assert.strictEqual(parseUpvotes("2.1m"), 2100000);
  assert.strictEqual(parseUpvotes(null), 0);
});

test("buildCommentsProps frames segments + wires background/sfx/accent", () => {
  const deck = {
    subreddit: "AskReddit", question: "Q?",
    segments: [
      { kind: "question", author: null, upvotes: null, text: "Q?", duration_sec: 2.0 },
      { kind: "comment", author: "u/a", upvotes: "1k", text: "c1", duration_sec: 1.0 },
    ],
  };
  const props = buildCommentsProps({
    runId: "r1", deck, captions: [], theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@h" },
    fps: 30, seed: "r1", accentPalette: ["#111", "#222"], musicSrc: "r1/music.mp3", musicVolume: 0.1, sfxSrc: "r1/sfx.mp3", backgroundSrc: "r1/bg.mp4",
  });
  assert.strictEqual(props.backgroundSrc, "r1/bg.mp4");
  assert.strictEqual(props.subreddit, "AskReddit");
  assert.strictEqual(props.segments[0].startFrame, 0);
  assert.strictEqual(props.segments[0].durationFrames, 60);
  assert.strictEqual(props.segments[1].startFrame, 60);
  assert.strictEqual(props.segments[1].durationFrames, 30);
  assert.ok(["#111", "#222"].includes(props.theme.accentColor));
});

const { buildMoneyProps } = require("./timeline");

test("buildMoneyProps = buildInputProps + per-scene stat/chart", () => {
  const scenesDoc = { scenes: [
    { id: 1, on_screen_text: "A", duration_sec: 2.0, stat: { value: "$1M", label: "x" }, chart: [1, 2, 3] },
    { id: 2, on_screen_text: null, duration_sec: 1.0, stat: null, chart: null },
  ]};
  const media = [{ sceneId: 1, type: "video", file: "scene_01.mp4" }, { sceneId: 2, type: "image", file: "scene_02.jpg" }];
  const props = buildMoneyProps({
    runId: "r1", scenesDoc, media, captions: [],
    theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@f" },
    fps: 30, seed: "r1", accentPalette: ["#16C784", "#F0B90B"], transitions: ["slideLeft", "fade"],
  });
  assert.deepStrictEqual(props.scenes[0].stat, { value: "$1M", label: "x" });
  assert.deepStrictEqual(props.scenes[0].chart, [1, 2, 3]);
  assert.strictEqual(props.scenes[1].stat, null);
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.ok(["#16C784", "#F0B90B"].includes(props.theme.accentColor));
});
