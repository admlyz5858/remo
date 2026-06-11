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
module.exports = { parseThreads, fetchTopComments };
