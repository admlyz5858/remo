#!/usr/bin/env python3
"""YouTube ops via refresh-token OAuth. Reads creds from env:
YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN.

Commands:
  upload   --video out.mp4 --meta meta.json --privacy private --out upload.json
  publish  --video-id ID            (set privacyStatus=public)
  delete   --video-id ID
"""
import argparse, json, os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

def service(refresh_env="YOUTUBE_REFRESH_TOKEN"):
    creds = Credentials(
        token=None,
        refresh_token=os.environ[refresh_env],
        client_id=os.environ["YOUTUBE_CLIENT_ID"],
        client_secret=os.environ["YOUTUBE_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/youtube"],
    )
    return build("youtube", "v3", credentials=creds)

def cmd_upload(a):
    meta = json.load(open(a.meta))
    yt = service(a.refresh_token_env)
    status = {"privacyStatus": a.privacy, "selfDeclaredMadeForKids": False}
    # Scheduled publish: YouTube requires privacyStatus=private + a future publishAt (RFC3339).
    if getattr(a, "publish_at", None):
        status["privacyStatus"] = "private"
        status["publishAt"] = a.publish_at
    body = {
        "snippet": {
            "title": meta["title"][:100],
            "description": meta.get("description", ""),
            "tags": meta.get("tags", []),
            "categoryId": str(meta.get("category_id", 27)),
        },
        "status": status,
    }
    media = MediaFileUpload(a.video, chunksize=-1, resumable=True)
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    out = {"video_id": resp["id"], "url": f"https://youtu.be/{resp['id']}", "privacy": status["privacyStatus"], "publish_at": getattr(a, "publish_at", None)}
    json.dump(out, open(a.out, "w"), indent=2)
    print(json.dumps(out))

def cmd_publish(a):
    yt = service(a.refresh_token_env)
    yt.videos().update(part="status", body={"id": a.video_id, "status": {"privacyStatus": "public"}}).execute()
    print(f"published {a.video_id}")

def cmd_delete(a):
    yt = service(a.refresh_token_env)
    yt.videos().delete(id=a.video_id).execute()
    print(f"deleted {a.video_id}")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    u = sub.add_parser("upload"); u.add_argument("--video", required=True); u.add_argument("--meta", required=True)
    u.add_argument("--privacy", default="private"); u.add_argument("--out", required=True)
    u.add_argument("--publish-at", default=None)  # RFC3339, e.g. 2026-06-14T09:00:00Z (schedules public)
    u.add_argument("--refresh-token-env", default="YOUTUBE_REFRESH_TOKEN"); u.set_defaults(fn=cmd_upload)
    pub = sub.add_parser("publish"); pub.add_argument("--video-id", required=True)
    pub.add_argument("--refresh-token-env", default="YOUTUBE_REFRESH_TOKEN"); pub.set_defaults(fn=cmd_publish)
    d = sub.add_parser("delete"); d.add_argument("--video-id", required=True)
    d.add_argument("--refresh-token-env", default="YOUTUBE_REFRESH_TOKEN"); d.set_defaults(fn=cmd_delete)
    a = p.parse_args(); a.fn(a)

if __name__ == "__main__":
    main()
