function hashSeed(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededInt(seed, n) {
  if (!n || n <= 0) return 0;
  return hashSeed(seed) % n;
}
function pickFrom(seed, arr) {
  return arr[seededInt(seed, arr.length)];
}
function pickMusic(files, seed) {
  return files.length ? files[seededInt(seed, files.length)] : null;
}
module.exports = { hashSeed, seededInt, pickFrom, pickMusic };
