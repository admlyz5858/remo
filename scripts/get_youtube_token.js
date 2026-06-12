#!/usr/bin/env node
/**
 * Interactive YouTube OAuth helper (loopback flow, no external deps).
 *
 * Authorizes the TARGET channel and stores its refresh token as the GitHub
 * secret YOUTUBE_REFRESH_TOKEN — without printing the token.
 *
 * Usage:
 *   node scripts/get_youtube_token.js
 *
 * Reuses the existing OAuth app (client_id/secret) from otomasyon/.env unless
 * YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET are set in the environment.
 * Open the printed URL in a browser ON THIS DEVICE, sign in to the channel you
 * want to publish to, and approve. The redirect lands on localhost.
 */
const http = require("node:http");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const REPO = process.env.REMO_REPO || "admlyz5858/remo";
const SECRET = process.env.REMO_TOKEN_SECRET || "YOUTUBE_REFRESH_TOKEN";
const PORT = 8765;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube";

function fromEnvFile(key) {
  try {
    const txt = fs.readFileSync("/storage/emulated/0/dos/otomasyon/.env", "utf8");
    const m = txt.match(new RegExp("^\\s*" + key + "\\s*=\\s*(.+?)\\s*$", "m"));
    return m ? m[1] : "";
  } catch { return ""; }
}

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || fromEnvFile("YOUTUBE_CLIENT_ID");
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || fromEnvFile("YOUTUBE_CLIENT_SECRET");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  }).toString();

console.log("\n1) Open this URL in a browser ON THIS DEVICE and sign in to the");
console.log("   channel you want to upload to, then approve:\n");
console.log(authUrl + "\n");
console.log(`2) Waiting for the redirect on ${REDIRECT} ...\n`);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  const code = u.searchParams.get("code");
  const err = u.searchParams.get("error");
  if (err) {
    res.end("Auth error: " + err + ". You can close this tab.");
    console.error("Auth error:", err);
    server.close();
    process.exit(1);
  }
  if (!code) { res.end("Waiting for authorization..."); return; }

  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT, grant_type: "authorization_code",
      }),
    });
    const tok = await tokenResp.json();
    if (!tokenResp.ok || !tok.refresh_token) {
      res.end("Token exchange failed. See terminal.");
      console.error("Token exchange failed:", JSON.stringify(tok));
      server.close();
      process.exit(1);
    }

    // Confirm which channel was authorized (no token printed).
    let channelTitle = "(unknown)";
    try {
      const ch = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${tok.access_token}` } },
      ).then((r) => r.json());
      channelTitle = ch.items?.[0]?.snippet?.title || channelTitle;
    } catch { /* non-fatal */ }

    execFileSync("gh", ["secret", "set", SECRET, "--repo", REPO, "--body", tok.refresh_token],
      { stdio: ["ignore", "ignore", "inherit"] });

    res.end(`Authorized channel: ${channelTitle}. Token saved. You can close this tab.`);
    console.log(`\n✅ Authorized channel: ${channelTitle}`);
    console.log(`✅ ${SECRET} secret updated on ${REPO} (token not printed).\n`);
    server.close();
    process.exit(0);
  } catch (e) {
    res.end("Error. See terminal.");
    console.error(e);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT);
