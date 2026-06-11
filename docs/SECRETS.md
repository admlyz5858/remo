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
