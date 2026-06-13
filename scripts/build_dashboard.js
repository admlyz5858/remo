function todayKey(iso) {
  return iso.slice(0, 10).replace(/-/g, "");
}

function buildDashboard(history, statsById, channels, nowIso) {
  const tk = todayKey(nowIso);
  const videos = (history.entries || [])
    .filter((e) => e.video_id && e.status !== "rejected")
    .map((e) => {
      const st = statsById[e.video_id] || {};
      return {
        video_id: e.video_id,
        url: e.url || `https://youtu.be/${e.video_id}`,
        mode: e.mode || "facts",
        topic: e.topic || e.slug || "",
        status: e.status || "pending",
        publish_at: e.publish_at || null,
        runId: e.runId || null,
        views: st.views || 0,
        likes: st.likes || 0,
        thumbnail: `https://img.youtube.com/vi/${e.video_id}/hqdefault.jpg`,
      };
    });
  const metrics = {
    scheduled: videos.filter((v) => v.status === "scheduled").length,
    published: videos.filter((v) => v.status === "published").length,
    today: videos.filter((v) => (v.runId || "").includes(`-${tk}-`)).length,
    total_views: videos.reduce((a, v) => a + (v.views || 0), 0),
  };
  return { updated_at: nowIso, channels, videos, metrics };
}

// stats fetch is injected for testing
async function fetchStats(videoIds, apiKey, fetchImpl = fetch) {
  const out = {};
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(",")}&key=${apiKey}`;
    try {
      const r = await fetchImpl(url, {});
      if (!r.ok) continue;
      const d = await r.json();
      for (const it of d.items || []) {
        out[it.id] = { views: Number(it.statistics.viewCount || 0), likes: Number(it.statistics.likeCount || 0) };
      }
    } catch (_) { /* best-effort */ }
  }
  return out;
}

module.exports = { buildDashboard, todayKey, fetchStats };

if (require.main === module) {
  const fs = require("node:fs");
  const channels = {
    facts: { name: "DustMust", handle: "@DustMust", niche: "İlginç bilgiler", accent: "#FFD400" },
    money: { name: "Fun Honey", handle: "@FunHoney", niche: "Para & finans", accent: "#16C784" },
  };
  const history = fs.existsSync("state/history.json") ? JSON.parse(fs.readFileSync("state/history.json", "utf8")) : { entries: [] };
  const ids = history.entries.filter((e) => e.video_id && e.status !== "rejected").map((e) => e.video_id);
  const nowIso = process.env.NOW_ISO || new Date().toISOString();
  fetchStats(ids, process.env.YOUTUBE_API_KEY).then((stats) => {
    const dash = buildDashboard(history, stats, channels, nowIso);
    fs.writeFileSync(process.env.OUT || "dashboard.json", JSON.stringify(dash, null, 2));
    console.log("dashboard.json videos:", dash.videos.length, "views:", dash.metrics.total_views);
  });
}
