# remo — English Fun-Facts Shorts Factory

One-trigger pipeline: topic → script → TTS → captions → stock media → Remotion render → private YouTube upload. Approve/reject from your phone via GitHub Actions.

## Run
- Produce: `gh workflow run produce.yml`
- Approve: `gh workflow run publish.yml -f video_id=<ID> -f action=approve`
- Reject:  `gh workflow run publish.yml -f video_id=<ID> -f action=reject`

## Local dev
- `npm test` — pipeline unit tests (node:test)
- `cd remotion && npm test` — animation helper tests
- `cd remotion && npx remotion studio` — preview (needs desktop browser)

## Config
Edit `pipeline/config.js` (voice, theme, model, stock order).

See `docs/SECRETS.md` for required GitHub Secrets.

## Background music
Add royalty-free `.mp3` files to `remotion/public/music/` (committed). One is chosen per video automatically; empty folder = no music.
