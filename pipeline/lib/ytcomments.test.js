const test = require("node:test");
const assert = require("node:assert");
const { parseThreads, fetchTopComments } = require("./ytcomments");

test("parseThreads maps comment threads to author/text/score", () => {
  const json = { items: [
    { snippet: { topLevelComment: { snippet: { authorDisplayName: "Ann", textOriginal: "haha", likeCount: 42 } } } },
  ] };
  assert.deepStrictEqual(parseThreads(json), [{ author: "Ann", text: "haha", score: 42 }]);
});

test("fetchTopComments returns [] on HTTP error (best-effort)", async () => {
  const fakeFetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  const r = await fetchTopComments("vid", { apiKey: "K", fetchImpl: fakeFetch });
  assert.deepStrictEqual(r, []);
});

const { parseVideos, getPopularVideo } = require("./ytcomments");

test("parseVideos maps id/title/channel", () => {
  const json = { items: [{ id: "v1", snippet: { title: "Cool video", channelTitle: "Ch" } }] };
  assert.deepStrictEqual(parseVideos(json), [{ id: "v1", title: "Cool video", channel: "Ch" }]);
});

test("getPopularVideo picks one deterministically by seed", async () => {
  const fakeFetch = async (url) => { assert.match(url, /chart=mostPopular/); return { ok: true, json: async () => ({ items: [
    { id: "a", snippet: { title: "A", channelTitle: "X" } },
    { id: "b", snippet: { title: "B", channelTitle: "Y" } },
  ] }) }; };
  const v1 = await getPopularVideo({ apiKey: "K", seed: "r1", fetchImpl: fakeFetch });
  const v2 = await getPopularVideo({ apiKey: "K", seed: "r1", fetchImpl: fakeFetch });
  assert.strictEqual(v1.id, v2.id);
  assert.ok(["a", "b"].includes(v1.id));
});
