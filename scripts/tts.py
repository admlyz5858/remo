#!/usr/bin/env python3
"""Synthesize one chunk of text to mp3 with edge-tts, optionally emitting
word-boundary timings (so no separate transcription/Whisper step is needed).

Usage:
  python scripts/tts.py --text "..." --voice en-US-ChristopherNeural --rate "+8%" \
      --out file.mp3 [--boundaries file.words.json]

The --boundaries sidecar is a JSON array of {text, offsetMs, durationMs} relative
to the start of this synthesis (edge-tts WordBoundary events, 100ns ticks -> ms).
"""
import argparse, asyncio, json
import edge_tts

async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--text", required=True)
    p.add_argument("--voice", default="en-US-ChristopherNeural")
    p.add_argument("--rate", default="+8%")
    p.add_argument("--out", required=True)
    p.add_argument("--boundaries")
    a = p.parse_args()

    communicate = edge_tts.Communicate(a.text, a.voice, rate=a.rate, boundary="WordBoundary")
    words = []
    with open(a.out, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({
                    "text": chunk["text"],
                    "offsetMs": chunk["offset"] / 10000,
                    "durationMs": chunk["duration"] / 10000,
                })
    if a.boundaries:
        with open(a.boundaries, "w") as f:
            json.dump(words, f)
    print(a.out)

if __name__ == "__main__":
    asyncio.run(main())
