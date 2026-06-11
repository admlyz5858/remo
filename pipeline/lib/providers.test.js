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

const { pexelsVideoCandidates, pixabayVideoCandidates, pixabayPhotoCandidates, unsplashCandidates } = require("./providers");

test("pexelsVideoCandidates returns up to N portrait video candidates with ids", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ videos: [
    { id: 11, video_files: [{ width: 1080, height: 1920, link: "http://v/a.mp4" }] },
    { id: 22, video_files: [{ width: 720, height: 1280, link: "http://v/b.mp4" }] },
  ] }) });
  const r = await pexelsVideoCandidates("octopus", { apiKey: "K", fetchImpl: fakeFetch });
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r[0], { type: "video", url: "http://v/a.mp4", id: "11" });
});

test("unsplashCandidates returns portrait image candidates", async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ results: [
    { id: "u1", urls: { regular: "http://u/1.jpg" } },
    { id: "u2", urls: { regular: "http://u/2.jpg" } },
  ] }) });
  const r = await unsplashCandidates("octopus", { apiKey: "K", fetchImpl: fakeFetch });
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r[1], { type: "image", url: "http://u/2.jpg", id: "u2" });
});

test("pixabay candidates: video + photo variants", async () => {
  const vids = async () => ({ ok: true, json: async () => ({ hits: [{ id: 5, videos: { large: { url: "http://p/v.mp4" } } }] }) });
  const v = await pixabayVideoCandidates("q", { apiKey: "K", fetchImpl: vids });
  assert.deepStrictEqual(v[0], { type: "video", url: "http://p/v.mp4", id: "5" });
  const pics = async () => ({ ok: true, json: async () => ({ hits: [{ id: 9, largeImageURL: "http://p/i.jpg" }] }) });
  const p = await pixabayPhotoCandidates("q", { apiKey: "K", fetchImpl: pics });
  assert.deepStrictEqual(p[0], { type: "image", url: "http://p/i.jpg", id: "9" });
});
