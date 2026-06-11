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
module.exports = { findMedia };
