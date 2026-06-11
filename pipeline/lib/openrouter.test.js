const test = require("node:test");
const assert = require("node:assert");
const { extractJSON, chatJSON } = require("./openrouter");

test("extractJSON parses fenced ```json blocks", () => {
  const out = extractJSON('blah\n```json\n{"a":1}\n```\nend');
  assert.deepStrictEqual(out, { a: 1 });
});

test("extractJSON parses raw object", () => {
  assert.deepStrictEqual(extractJSON('  {"b": 2}  '), { b: 2 });
});

test("chatJSON sends prompt and returns parsed JSON", async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
  };
  const res = await chatJSON({ apiKey: "k", model: "m", messages: [{ role: "user", content: "hi" }], fetchImpl: fakeFetch });
  assert.deepStrictEqual(res, { ok: true });
  assert.strictEqual(calls[0].model, "m");
});
