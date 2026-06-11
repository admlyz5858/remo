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

def service():
    creds = Credentials(
        token=None,
        refresh_token=os.environ["YOUTUBE_REFRESH_TOKEN"],
        client_id=os.environ["YOUTUBE_CLIENT_ID"],
        client_secret=os.environ["YOUTUBE_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/youtube"],
    )
    return build("youtube", "v3", credentials=creds)

def cmd_upload(a):
    meta = json.load(open(a.meta))
    yt = service()
    body = {
        "snippet": {
            "title": meta["title"][:100],
            "description": meta.get("description", ""),
            "tags": meta.get("tags", []),
            "categoryId": str(meta.get("category_id", 27)),
        },
        "status": {"privacyStatus": a.privacy, "selfDeclaredMadeForKids": False},
    }
    media = MediaFileUpload(a.video, chunksize=-1, resumable=True)
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    out = {"video_id": resp["id"], "url": f"https://youtu.be/{resp['id']}", "privacy": a.privacy}
    json.dump(out, open(a.out, "w"), indent=2)
    print(json.dumps(out))

def cmd_publish(a):
    yt = service()
    yt.videos().update(part="status", body={"id": a.video_id, "status": {"privacyStatus": "public"}}).execute()
    print(f"published {a.video_id}")

def cmd_delete(a):
    yt = service()
    yt.videos().delete(id=a.video_id).execute()
    print(f"deleted {a.video_id}")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    u = sub.add_parser("upload"); u.add_argument("--video", required=True); u.add_argument("--meta", required=True)
    u.add_argument("--privacy", default="private"); u.add_argument("--out", required=True); u.set_defaults(fn=cmd_upload)
    pub = sub.add_parser("publish"); pub.add_argument("--video-id", required=True); pub.set_defaults(fn=cmd_publish)
    d = sub.add_parser("delete"); d.add_argument("--video-id", required=True); d.set_defaults(fn=cmd_delete)
    a = p.parse_args(); a.fn(a)

if __name__ == "__main__":
    main()
