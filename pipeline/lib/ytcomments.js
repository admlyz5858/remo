function parseThreads(json) {
  return (json.items || []).map((it) => {
    const s = it.snippet.topLevelComment.snippet;
    return { author: s.authorDisplayName, text: s.textOriginal, score: s.likeCount || 0 };
  });
}
async function fetchTopComments(videoId, { apiKey, fetchImpl = fetch, max = 50 }) {
  const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=${max}&key=${apiKey}`;
  try {
    const r = await fetchImpl(url, {});
    if (!r.ok) return [];
    return parseThreads(await r.json());
  } catch (_) { return []; }
}
const { pickFrom } = require("./seed");

function parseVideos(json) {
  return (json.items || []).map((it) => ({ id: it.id, title: it.snippet.title, channel: it.snippet.channelTitle }));
}
async function getPopularVideo({ apiKey, fetchImpl = fetch, seed, regionCode = "US", max = 30 }) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=${regionCode}&maxResults=${max}&key=${apiKey}`;
  const r = await fetchImpl(url, {});
  if (!r.ok) throw new Error(`yt popular HTTP ${r.status}`);
  const vids = parseVideos(await r.json());
  if (!vids.length) throw new Error("no popular videos");
  return pickFrom(seed, vids);
}
module.exports = { parseThreads, fetchTopComments, parseVideos, getPopularVideo };
