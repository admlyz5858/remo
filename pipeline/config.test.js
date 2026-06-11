const test = require("node:test");
const assert = require("node:assert");
const cfg = require("./config");

test("config has render + stock + voice defaults", () => {
  assert.strictEqual(cfg.render.width, 1080);
  assert.strictEqual(cfg.render.height, 1920);
  assert.strictEqual(cfg.render.fps, 30);
  assert.deepStrictEqual(cfg.stockOrder, ["pexels", "pixabay", "unsplash"]);
  assert.ok(cfg.voice.startsWith("en-US-"));
  assert.ok(cfg.theme.accentColor.startsWith("#"));
});

test("config has accentPalette, transitions, music", () => {
  assert.ok(Array.isArray(cfg.accentPalette) && cfg.accentPalette.length >= 3);
  assert.deepStrictEqual(cfg.transitions, ["slideLeft", "slideUp", "zoomIn", "fade"]);
  assert.strictEqual(cfg.music.dir, "remotion/public/music");
  assert.ok(cfg.music.volume > 0 && cfg.music.volume < 1);
});

test("config has sfx dir + vision model", () => {
  assert.strictEqual(cfg.sfx.dir, "remotion/public/sfx");
  assert.ok(typeof cfg.visionModel === "string" && cfg.visionModel.length > 0);
});
