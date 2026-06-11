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
