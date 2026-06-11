const fs = require("node:fs");
async function download(url, dest, fetchImpl = fetch) {
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(`download HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
}
module.exports = { download };
