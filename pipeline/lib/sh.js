const { spawn } = require("node:child_process");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited ${code}`))));
  });
}
async function synth(text, out, voice, rate) {
  const boundaries = out + ".words.json";
  await run("python", ["scripts/tts.py", "--text", text, "--voice", voice, "--rate", rate, "--out", out, "--boundaries", boundaries]);
  return JSON.parse(require("node:fs").readFileSync(boundaries, "utf8"));
}
async function probeDuration(file) {
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return parseFloat(out);
}
async function concat(files, out) {
  const listFile = out + ".txt";
  require("node:fs").writeFileSync(listFile, files.map((f) => `file '${require("node:path").resolve(f)}'`).join("\n"));
  // Re-encode (not -c copy): stream-copying independently-encoded edge-tts MP3s
  // causes duration drift that desyncs captions/progress from the voice track.
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c:a", "libmp3lame", "-b:a", "192k", out]);
}
module.exports = { run, synth, probeDuration, concat };
