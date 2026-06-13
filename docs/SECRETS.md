# GitHub Secrets (Repo → Settings → Secrets and variables → Actions)

Copy values from otomasyon/.env:

| Secret | Source key in otomasyon/.env |
|---|---|
| OPENROUTER_API_KEY | OPENROUTER_API_KEY |
| PEXELS_API_KEY | PEXELS_API_KEY |
| PIXABAY_API_KEY | PIXABAY_API_KEY |
| UNSPLASH_API_KEY | UNSPLASH_API_KEY |
| YOUTUBE_CLIENT_ID | YOUTUBE_CLIENT_ID |
| YOUTUBE_CLIENT_SECRET | YOUTUBE_CLIENT_SECRET |
| YOUTUBE_REFRESH_TOKEN | YOUTUBE_REFRESH_TOKEN |

Trigger production: `gh workflow run produce.yml`
Approve:  `gh workflow run publish.yml -f video_id=<ID> -f action=approve`
Reject:   `gh workflow run publish.yml -f video_id=<ID> -f action=reject`

## Comments mode secrets
| Secret | Purpose |
|---|---|
| REDDIT_USER_AGENT | e.g. `remo-bot/1.0 (by /u/yourname)` — required by Reddit JSON |
| YOUTUBE_API_KEY | YouTube Data API key (optional YouTube comments source) |
| YT_COMMENTS_REFRESH_TOKEN | refresh token for the SECOND channel (authorize via scripts/get_youtube_token.js) |

Produce comments: `gh workflow run produce.yml -f mode=comments`

## Dashboard
| Secret | Purpose |
|---|---|
| DASHBOARD_DEPLOY_KEY | SSH private key (ed25519) for the write deploy key on the public `remo-dashboard` repo. `dashboard.yml` uses it to push `dashboard.json`. Auto-provisioned during setup — the matching public key is registered as a write deploy key on `remo-dashboard`; no manual PAT needed. |

The dashboard's "Produce" button uses a SEPARATE fine-grained PAT stored only in your browser (localStorage `ghpat`, Actions:write on `remo`), never committed. This is the only token you must create by hand — paste it via the ⚙️ button on the dashboard.

Dashboard URL: https://admlyz5858.github.io/remo-dashboard/
