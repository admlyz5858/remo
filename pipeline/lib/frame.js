const { run } = require("./sh");

// Extract a single representative JPEG from a media file (video: at atSec; image: re-encode).
async function extractFrame(mediaPath, outJpg, atSec = 1) {
  await run("ffmpeg", ["-y", "-ss", String(atSec), "-i", mediaPath, "-frames:v", "1", "-vf", "scale=512:-1", outJpg]);
  return outJpg;
}
module.exports = { extractFrame };
