const test = require("node:test");
const assert = require("node:assert");
const { buildDashboard, todayKey } = require("./build_dashboard");

const channels = {
  facts: { name: "DustMust", handle: "@DustMust", niche: "Facts", accent: "#FFD400" },
  money: { name: "Fun Honey", handle: "@FunHoney", niche: "Money", accent: "#16C784" },
};

test("buildDashboard maps videos, stats, thumbnails, metrics", () => {
  const history = { entries: [
    { video_id: "a", url: "u/a", mode: "facts", topic: "Sloths", status: "scheduled", publish_at: "2026-06-14T09:00:00Z", runId: "run-20260613-101010" },
    { video_id: "b", url: "u/b", mode: "money", topic: "Pricing", status: "published", runId: "run-20260612-101010" },
    { slug: "no-video-yet", status: "pending" },
    { video_id: "c", mode: "facts", topic: "Old", status: "rejected", runId: "run-20260611-101010" },
  ]};
  const stats = { b: { views: 1000, likes: 50 } };
  const d = buildDashboard(history, stats, channels, "2026-06-13T12:00:00Z");
  assert.strictEqual(d.videos.length, 2); // entries without video_id dropped
  assert.strictEqual(d.videos[0].thumbnail, "https://img.youtube.com/vi/a/hqdefault.jpg");
  assert.strictEqual(d.videos[1].views, 1000);
  assert.strictEqual(d.metrics.scheduled, 1);
  assert.strictEqual(d.metrics.published, 1);
  assert.strictEqual(d.metrics.today, 1); // run-20260613 == 2026-06-13
  assert.strictEqual(d.metrics.total_views, 1000);
  assert.strictEqual(d.updated_at, "2026-06-13T12:00:00Z");
  assert.strictEqual(d.channels.facts.name, "DustMust");
});

test("todayKey extracts YYYYMMDD from an ISO date", () => {
  assert.strictEqual(todayKey("2026-06-13T12:00:00Z"), "20260613");
});
