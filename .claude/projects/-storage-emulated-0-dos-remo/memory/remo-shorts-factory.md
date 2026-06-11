---
name: remo-shorts-factory
description: remo project — English fun-facts YouTube Shorts factory, architecture + key constraints
metadata:
  type: project
---

`/storage/emulated/0/dos/remo` is an **independent** English "fun facts" YouTube Shorts factory (Remotion-centric). It does NOT touch `/storage/emulated/0/dos/otomasyon` (a separate, live Türkçe/gezi/FFmpeg system) — remo only borrows otomasyon's `.env` API keys.

Pipeline (Node CommonJS, `pipeline/`): 01-topic (OpenRouter) → 02-script+meta → 03-voiceover (edge-tts + ffmpeg re-encode concat) → 04-captions (whisper) → 05-media (Pexels→Pixabay→Unsplash portrait fallback) → 06-render (Remotion 1080×1920) → YouTube private upload. Pure logic is unit-tested with `node:test` (24/24). Stages accumulate JSON in `run/<id>/`.

**Key constraint:** repo lives on Termux external storage (FAT/exFAT) which can't create symlinks, so `npm install` in `remotion/` FAILS locally → Remotion type-check + render only run on GitHub Actions, never locally. Run `npm test` with quoted glob `"pipeline/**/*.test.js"` (bash globstar is off; unquoted misses root-level stage tests).

Control flow = Claude as remote control: user says "üret" → `gh workflow run produce.yml` → renders + private upload → user approves → `gh workflow run publish.yml -f video_id=<ID> -f action=approve|reject` (approve→public, reject→delete). GitHub repo: `admlyz5858/remo` (private). Spec+plan in `docs/superpowers/`.

**Next step before first real run:** add GitHub Secrets per `docs/SECRETS.md` (OPENROUTER/PEXELS/PIXABAY/UNSPLASH keys + YOUTUBE client/secret/refresh-token from otomasyon/.env). Non-gating review follow-ups left as TODO: produce.yml captures run-id via `ls -t run` (mtime) rather than run.js JSON stdout (R4).
