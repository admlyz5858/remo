const fs = require("node:fs");
const path = require("node:path");

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function runPath(runRoot, id, ...parts) {
  return path.join(runRoot, id, ...parts);
}
module.exports = { writeJSON, readJSON, runPath };
