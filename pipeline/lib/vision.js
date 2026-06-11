const CENTER = { box: { x: 0.5, y: 0.45, w: 0, h: 0 }, label: "" };

function clamp01(n) { return Math.min(Math.max(Number(n) || 0, 0), 1); }

function parseBox(obj) {
  if (!obj || !obj.box) return { box: { ...CENTER.box }, label: "" };
  const b = obj.box;
  return {
    box: { x: clamp01(b.x), y: clamp01(b.y), w: clamp01(b.w), h: clamp01(b.h) },
    label: typeof obj.label === "string" ? obj.label : "",
  };
}

function extractJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in vision output");
  return JSON.parse(text.slice(start, end + 1));
}

async function detectSubject({ apiKey, imageBase64, narration, query, fetchImpl = fetch, model = "gemini-flash-latest" }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = `Narration: "${narration}". Find the main subject described as "${query}" in this image. Respond ONLY JSON: {"box":{"x":CENTER_X,"y":CENTER_Y,"w":WIDTH,"h":HEIGHT},"label":"2-3 words"} with normalized 0-1 coordinates (x,y = center). If unclear use {"box":{"x":0.5,"y":0.45,"w":0,"h":0},"label":""}.`;
  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }] }],
    generationConfig: { temperature: 0 },
  };
  const r = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) return { box: { ...CENTER.box }, label: "" };
  const data = await r.json();
  try {
    const text = data.candidates[0].content.parts[0].text;
    return parseBox(extractJSON(text));
  } catch (_) {
    return { box: { ...CENTER.box }, label: "" };
  }
}
module.exports = { parseBox, detectSubject };
