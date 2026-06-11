function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object found in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function chatJSON({ apiKey, model, messages, fetchImpl = fetch, temperature = 0.8 }) {
  const resp = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!resp.ok) throw new Error(`OpenRouter HTTP ${resp.status}`);
  const data = await resp.json();
  return extractJSON(data.choices[0].message.content);
}
module.exports = { extractJSON, chatJSON };
