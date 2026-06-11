const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const fs = require("node:fs"); const path = require("node:path");
const { prepareRender } = require("./06-render");

function seedRun(runRoot, pubRoot) {
  const dir = path.join(runRoot, "r1"); fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.mkdirSync(path.join(pubRoot, "r1"), { recursive: true });
  fs.writeFileSync(path.join(dir, "audio", "voiceover.mp3"), "AUDIO");
  fs.writeFileSync(path.join(dir, "scenes.json"), JSON.stringify({ scenes: [{ id: 1, on_screen_text: "A", duration_sec: 2.0 }], total_duration_sec: 2.0 }));
  fs.writeFileSync(path.join(dir, "media.json"), JSON.stringify([{ sceneId: 1, type: "video", file: "scene_01.mp4" }]));
  fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify([{ text: "hi", startMs: 0, endMs: 500, timestampMs: 250, confidence: 1 }]));
  fs.writeFileSync(path.join(dir, "annotations.json"), JSON.stringify([{ sceneId: 1, box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "x", type: "circle" }]));
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ title: "T", description: "A quick fact.", tags: ["shorts"] }));
}
const baseArgs = (runRoot, pubRoot, musicDir, sfxDir) => ({
  runId: "r1", runRoot, pubRoot,
  theme: { accentColor: "#000", fontFamily: "Anton", channelName: "@c" },
  fps: 30, seed: "r1", accentPalette: ["#111", "#222"], transitions: ["slideLeft", "fade"],
  musicDir, sfxDir, musicVolume: 0.1,
});

test("prepareRender copies audio, builds props, no music when dir empty/missing", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rnd-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpub-"));
  seedRun(runRoot, pubRoot);
  const props = prepareRender(baseArgs(runRoot, pubRoot, path.join(runRoot, "no-music"), path.join(runRoot, "no-sfx")));
  assert.strictEqual(props.scenes[0].durationFrames, 60);
  assert.strictEqual(props.audioSrc, "r1/voiceover.mp3");
  assert.strictEqual(props.musicSrc, null);
  assert.strictEqual(fs.readFileSync(path.join(pubRoot, "r1", "voiceover.mp3"), "utf8"), "AUDIO");
  const meta = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "meta.json"), "utf8"));
  assert.ok(!meta.description.includes("incompetech")); // no credit when no music
});

test("prepareRender selects + copies a music track when present", () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rnd-"));
  const pubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpub-"));
  seedRun(runRoot, pubRoot);
  const musicDir = path.join(runRoot, "music"); fs.mkdirSync(musicDir, { recursive: true });
  fs.writeFileSync(path.join(musicDir, "a.mp3"), "MUSICA");
  fs.writeFileSync(path.join(musicDir, "b.mp3"), "MUSICB");
  const props = prepareRender(baseArgs(runRoot, pubRoot, musicDir, path.join(runRoot, "no-sfx")));
  assert.strictEqual(props.musicSrc, "r1/music.mp3");
  assert.ok(fs.existsSync(path.join(pubRoot, "r1", "music.mp3")));
  const meta = JSON.parse(fs.readFileSync(path.join(runRoot, "r1", "meta.json"), "utf8"));
  assert.ok(meta.description.includes("incompetech")); // CC-BY credit appended
  assert.deepStrictEqual(props.scenes[0].annotation, { box: { x: 0.5, y: 0.4, w: 0.2, h: 0.2 }, label: "x", type: "circle" });
});
