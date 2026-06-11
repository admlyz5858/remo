const test = require("node:test");
const assert = require("node:assert");
const { pexels, pixabay, unsplash } = require("./providers");

test("pexels requests portrait video and maps the best file", async () => {
  let calledUrl, calledHeaders;
  const fakeFetch = async (url, opts) => {
    calledUrl = url; calledHeaders = opts.headers;
    return { ok: true, json: async () => ({ videos: [
      { video_files: [{ width: 1080, height: 1920, link: "http://v/portrait.mp4" }] },
    ] }) };
  };
  const r = await pexels("octopus", { apiKey: "PKEY", fetchImpl: fakeFetch });
  assert.match(calledUrl, /orientation=portrait/);
  assert.match(calledUrl, /query=octopus/);
  assert.strictEqual(calledHeaders.Authorization, "PKEY");
  assert.deepStrictEqual(r, { type: "video", url: "http://v/portrait.mp4" });
});

test("pixabay returns image url when no video", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ hits: [{ largeImageURL: "http://i/p.jpg" }] }) });
  const r = await pixabay("octopus", { apiKey: "K", fetchImpl: fakeFetch, kind: "image" });
  assert.deepStrictEqual(r, { type: "image", url: "http://i/p.jpg" });
});

test("unsplash returns portrait image", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ results: [{ urls: { regular: "http://u/p.jpg" } }] }) });
  const r = await unsplash("octopus", { apiKey: "K", fetchImpl: fakeFetch });
  assert.deepStrictEqual(r, { type: "image", url: "http://u/p.jpg" });
});
