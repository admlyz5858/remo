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

test("config has mode + comments settings", () => {
  assert.strictEqual(cfg.mode, "facts");
  assert.ok(Array.isArray(cfg.subreddits) && cfg.subreddits.length >= 1);
  assert.strictEqual(cfg.gameplay.dir, "remotion/public/gameplay");
  assert.strictEqual(cfg.commentsTokenEnv, "YT_COMMENTS_REFRESH_TOKEN");
});

test("config has money niche (accent + channel)", () => {
  assert.ok(Array.isArray(cfg.niches.money.accentPalette) && cfg.niches.money.accentPalette.length >= 2);
  assert.strictEqual(cfg.niches.money.channelName, "@FunHoney");
});
