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

function buildInputProps({ runId, scenesDoc, media, captions, theme, fps, seed, accentPalette, transitions, musicSrc, musicVolume }) {
  const byId = new Map(media.map((m) => [m.sceneId, m]));
  const accentColor = pickFrom(seed, accentPalette);
  let frame = 0;
  const scenes = scenesDoc.scenes.map((s) => {
    const durationFrames = Math.round(s.duration_sec * fps);
    const m = byId.get(s.id);
    const node = {
      id: s.id,
      onScreenText: s.on_screen_text || null,
      startFrame: frame,
      durationFrames,
      media: m ? { type: m.type, src: `${runId}/${m.file}` } : { type: "image", src: "" },
      transition: pickFrom(`${seed}:${s.id}`, transitions),
    };
    frame += durationFrames;
    return node;
  });
  return {
    fps, width: 1080, height: 1920,
    audioSrc: `${runId}/voiceover.mp3`,
    musicSrc: musicSrc || null,
    musicVolume,
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
module.exports = { applyTimings, buildInputProps, assembleCaptions };
