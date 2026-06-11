const test = require("node:test");
const assert = require("node:assert");
const { parseListing, parseComments, fetchTopPost } = require("./reddit");

test("parseListing keeps SFW question-like posts", () => {
  const json = { data: { children: [
    { data: { id: "a1", title: "What's the funniest thing?", over_18: false, stickied: false, num_comments: 500 } },
    { data: { id: "a2", title: "NSFW story", over_18: true, stickied: false, num_comments: 999 } },
    { data: { id: "a3", title: "Just a statement", over_18: false, stickied: false, num_comments: 10 } },
  ] } };
  const posts = parseListing(json);
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].id, "a1");
  assert.strictEqual(posts[0].title, "What's the funniest thing?");
});

test("parseComments extracts top-level bodies with author + score", () => {
  const json = [ {}, { data: { children: [
    { kind: "t1", data: { body: "lol great", author: "bob", score: 1234 } },
    { kind: "t1", data: { body: "[deleted]", author: "x", score: 5 } },
    { kind: "more", data: {} },
  ] } } ];
  const c = parseComments(json);
  assert.strictEqual(c.length, 1);
  assert.deepStrictEqual(c[0], { author: "bob", text: "lol great", score: 1234 });
});

test("fetchTopPost requests with a User-Agent and returns a post", async () => {
  let hdrs;
  const fakeFetch = async (url, opts) => { hdrs = opts.headers; return { ok: true, json: async () => ({ data: { children: [
    { data: { id: "z9", title: "What is the best?", over_18: false, stickied: false, num_comments: 800 } },
  ] } }) }; };
  const p = await fetchTopPost("AskReddit", { userAgent: "remo/1.0", fetchImpl: fakeFetch });
  assert.strictEqual(hdrs["User-Agent"], "remo/1.0");
  assert.strictEqual(p.id, "z9");
  assert.strictEqual(p.subreddit, "AskReddit");
});
