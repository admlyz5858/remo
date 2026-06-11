function isDuplicate(history, slug) {
  const s = String(slug).toLowerCase();
  return (history.entries || []).some((e) => e.slug.toLowerCase() === s);
}
function recentTopics(history) {
  return (history.entries || []).map((e) => e.topic);
}
function addEntry(history, entry) {
  return { ...history, entries: [...(history.entries || []), entry] };
}
module.exports = { isDuplicate, recentTopics, addEntry };
