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

const { findMediaCandidates } = require("./stock");

test("findMediaCandidates flattens providers in order, tagging provider", async () => {
  const providers = {
    pexelsVideo: async () => [{ type: "video", url: "http://x/v1.mp4", id: "1" }],
    pixabayVideo: async () => [{ type: "video", url: "http://x/v2.mp4", id: "2" }],
    pixabayPhoto: async () => { throw new Error("skip"); },
    unsplash: async () => [{ type: "image", url: "http://x/i.jpg", id: "u" }],
  };
  const out = await findMediaCandidates("q", ["pexelsVideo", "pixabayVideo", "pixabayPhoto", "unsplash"], providers);
  assert.strictEqual(out.length, 3);
  assert.deepStrictEqual(out[0], { type: "video", url: "http://x/v1.mp4", id: "1", provider: "pexelsVideo" });
  assert.strictEqual(out[2].provider, "unsplash");
});
