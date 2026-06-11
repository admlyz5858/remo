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
