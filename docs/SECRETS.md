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
