const SLOTS = { facts: [9, 15], money: [11, 17] }; // UTC hours, staggered

function nextSlotIso(videos, mode, nowMs) {
  const slots = SLOTS[mode] || [9, 15];
  const sched = (videos || [])
    .filter((v) => v.mode === mode && v.publish_at)
    .map((v) => Date.parse(v.publish_at))
    .filter((n) => !isNaN(n));
  let after = nowMs;
  if (sched.length) after = Math.max(after, Math.max(...sched));
  // scan forward day by day for the first slot strictly after `after`
  const d = new Date(after);
  for (let day = 0; day < 14; day++) {
    for (const h of slots) {
      const cand = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + day, h, 0, 0);
      if (cand > after) return new Date(cand).toISOString();
    }
  }
  return new Date(after + 3600000).toISOString();
}
module.exports = { nextSlotIso, SLOTS };
