function parseListing(json) {
  return (json.data?.children || [])
    .map((c) => c.data)
    .filter((d) => d && !d.over_18 && !d.stickied && /\?\s*$/.test(d.title) && (d.num_comments || 0) >= 50)
    .map((d) => ({ id: d.id, title: d.title.trim(), num_comments: d.num_comments }));
}
function parseComments(json) {
  const children = json?.[1]?.data?.children || [];
  return children
    .filter((c) => c.kind === "t1" && c.data && c.data.body && !["[deleted]", "[removed]"].includes(c.data.body))
    .map((c) => ({ author: c.data.author, text: c.data.body.trim(), score: c.data.score || 0 }));
}
async function fetchTopPost(subreddit, { userAgent, fetchImpl = fetch, period = "week" }) {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${period}&limit=25`;
  const r = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
  if (!r.ok) throw new Error(`reddit listing HTTP ${r.status}`);
  const posts = parseListing(await r.json());
  if (!posts.length) throw new Error(`no suitable post in r/${subreddit}`);
  return { ...posts[0], subreddit };
}
async function fetchComments(subreddit, postId, { userAgent, fetchImpl = fetch }) {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}/.json?limit=80&sort=top`;
  const r = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
  if (!r.ok) throw new Error(`reddit comments HTTP ${r.status}`);
  return parseComments(await r.json());
}
module.exports = { parseListing, parseComments, fetchTopPost, fetchComments };
