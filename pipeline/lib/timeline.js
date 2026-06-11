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

function buildInputProps({ runId, scenesDoc, media, captions, theme, fps }) {
  const byId = new Map(media.map((m) => [m.sceneId, m]));
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
    };
    frame += durationFrames;
    return node;
  });
  return { fps, width: 1080, height: 1920, audioSrc: `${runId}/voiceover.mp3`, theme, captions, scenes };
}
module.exports = { applyTimings, buildInputProps };
