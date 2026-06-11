const test = require("node:test");
const assert = require("node:assert");
const { findMedia } = require("./stock");

test("falls back to next provider when first returns null", async () => {
  const providers = {
    pexels: async () => null,
    pixabay: async () => ({ type: "video", url: "http://x/v.mp4" }),
    unsplash: async () => { throw new Error("should not reach"); },
  };
  const r = await findMedia("octopus", ["pexels", "pixabay", "unsplash"], providers);
  assert.deepStrictEqual(r, { type: "video", url: "http://x/v.mp4", provider: "pixabay" });
});

test("returns null when all providers miss", async () => {
  const providers = { pexels: async () => null, pixabay: async () => null, unsplash: async () => null };
  const r = await findMedia("nope", ["pexels", "pixabay", "unsplash"], providers);
  assert.strictEqual(r, null);
});

test("skips a throwing provider and continues", async () => {
  const providers = {
    pexels: async () => { throw new Error("rate limit"); },
    pixabay: async () => ({ type: "image", url: "http://x/i.jpg" }),
  };
  const r = await findMedia("q", ["pexels", "pixabay"], providers);
  assert.strictEqual(r.provider, "pixabay");
});
