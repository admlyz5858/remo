// Each provider fn: async (query) => ({ type:"video"|"image", url } | null)
async function findMedia(query, order, providers) {
  for (const name of order) {
    const fn = providers[name];
    if (!fn) continue;
    try {
      const hit = await fn(query);
      if (hit && hit.url) return { ...hit, provider: name };
    } catch (_) { /* try next provider */ }
  }
  return null;
}
// Returns a flat, ordered list of candidates across providers (best-effort).
async function findMediaCandidates(query, order, providers) {
  const out = [];
  for (const name of order) {
    const fn = providers[name];
    if (!fn) continue;
    try {
      const hits = await fn(query);
      for (const h of hits || []) {
        if (h && h.url) out.push({ ...h, provider: name });
      }
    } catch (_) { /* skip provider */ }
  }
  return out;
}
module.exports = { findMedia, findMediaCandidates };
