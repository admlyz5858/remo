const test = require("node:test");
const assert = require("node:assert");
const { parseBox, detectSubject } = require("./vision");

test("parseBox clamps to 0..1 and falls back to center", () => {
  assert.deepStrictEqual(parseBox({ box: { x: 1.5, y: -0.2, w: 0.3, h: 0.3 }, label: "x" }),
    { box: { x: 1, y: 0, w: 0.3, h: 0.3 }, label: "x" });
  assert.deepStrictEqual(parseBox(null), { box: { x: 0.5, y: 0.45, w: 0, h: 0 }, label: "" });
});

test("detectSubject posts image to Gemini and returns parsed box", async () => {
  let sentUrl;
  const fakeFetch = async (url) => {
    sentUrl = url;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"box":{"x":0.4,"y":0.3,"w":0.2,"h":0.2},"label":"heart"}' }] } }] }) };
  };
  const r = await detectSubject({ apiKey: "K", imageBase64: "AAAA", narration: "n", query: "q", fetchImpl: fakeFetch });
  assert.match(sentUrl, /generativelanguage\.googleapis\.com/);
  assert.deepStrictEqual(r, { box: { x: 0.4, y: 0.3, w: 0.2, h: 0.2 }, label: "heart" });
});

test("detectSubject returns center on HTTP error", async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const r = await detectSubject({ apiKey: "K", imageBase64: "AAAA", narration: "n", query: "q", fetchImpl: fakeFetch });
  assert.deepStrictEqual(r, { box: { x: 0.5, y: 0.45, w: 0, h: 0 }, label: "" });
});
