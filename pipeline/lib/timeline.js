const { pickFrom } = require("./seed");

function applyTimings(scenes, durationsSec) {
  let cursor = 0;
  const out = scenes.map((s, i) => {
    const dur = durationsSec[i];
    const start = Math.round(cursor * 1000);
    cursor += dur;
    return { ...s, duration_sec: dur, audio_start_ms: start, audio_end_ms: Math.round(cursor * 1000) };
  });
  return { scenes: out, total_duration_sec: Math.round(cursor * 1000) / 1000 };
}

function buildInputProps({ runId, scenesDoc, media, captions, theme, fps, seed, accentPalette, transitions, musicSrc, musicVolume, annotations = [], sfxSrc = null }) {
  const byId = new Map(media.map((m) => [m.sceneId, m]));
  const annById = new Map((annotations || []).map((a) => [a.sceneId, a]));
  const accentColor = pickFrom(seed, accentPalette);
  let frame = 0;
  const scenes = scenesDoc.scenes.map((s) => {
    const durationFrames = Math.round(s.duration_sec * fps);
    const m = byId.get(s.id);
    const a = annById.get(s.id);
    const node = {
      id: s.id,
      onScreenText: s.on_screen_text || null,
      emoji: s.emoji || null,
      startFrame: frame,
      durationFrames,
      media: m ? { type: m.type, src: `${runId}/${m.file}` } : { type: "image", src: "" },
      transition: pickFrom(`${seed}:${s.id}`, transitions),
      annotation: a ? { box: a.box, label: a.label, type: a.type } : null,
    };
    frame += durationFrames;
    return node;
  });
  return {
    fps, width: 1080, height: 1920,
    audioSrc: `${runId}/voiceover.mp3`,
    musicSrc: musicSrc || null,
    musicVolume,
    sfxSrc: sfxSrc || null,
    hookQuestion: scenesDoc.hook_question || null,
    waitTeaser: scenesDoc.wait_teaser || null,
    payoff: scenesDoc.payoff || null,
    cta: scenesDoc.cta || null,
    theme: { ...theme, accentColor },
    captions, scenes,
  };
}
// Build @remotion/captions Caption[] from per-scene edge-tts word boundaries.
// perScene[i] = [{ text, offsetMs, durationMs }] relative to that scene's audio.
// startsMs[i] = absolute audio_start_ms of scene i (from applyTimings).
function assembleCaptions(perScene, startsMs) {
  const caps = [];
  perScene.forEach((words, i) => {
    const base = startsMs[i];
    for (const w of words) {
      const startMs = Math.round(base + w.offsetMs);
      const endMs = Math.round(base + w.offsetMs + w.durationMs);
      caps.push({ text: w.text, startMs, endMs, timestampMs: Math.round((startMs + endMs) / 2), confidence: 1 });
    }
  });
  return caps;
}
function parseUpvotes(s) {
  if (!s) return 0;
  const m = String(s).trim().toLowerCase().match(/^([\d.]+)\s*([km]?)$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return Math.round(n * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1));
}

function buildCommentsProps({ runId, deck, captions, theme, fps, seed, accentPalette, musicSrc, musicVolume, sfxSrc, backgroundSrc }) {
  const accentColor = pickFrom(seed, accentPalette);
  let frame = 0;
  const segments = deck.segments.map((s) => {
    const durationFrames = Math.round(s.duration_sec * fps);
    const node = { kind: s.kind, author: s.author || null, upvotes: s.upvotes || null, text: s.text, startFrame: frame, durationFrames };
    frame += durationFrames;
    return node;
  });
  return {
    fps, width: 1080, height: 1920,
    audioSrc: `${runId}/voiceover.mp3`,
    musicSrc: musicSrc || null, musicVolume, sfxSrc: sfxSrc || null,
    backgroundSrc, subreddit: deck.subreddit, question: deck.question,
    theme: { ...theme, accentColor }, captions, segments,
  };
}

function buildMoneyProps(args) {
  const base = buildInputProps(args);
  const byId = new Map(args.scenesDoc.scenes.map((s) => [s.id, s]));
  base.scenes = base.scenes.map((node) => {
    const s = byId.get(node.id) || {};
    return { ...node, stat: s.stat || null, chart: Array.isArray(s.chart) ? s.chart : null };
  });
  return base;
}
module.exports = { applyTimings, buildInputProps, assembleCaptions, buildCommentsProps, parseUpvotes, buildMoneyProps };
