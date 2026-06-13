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


async def _synthesize(text, voice, rate):
    """Stream one synthesis into memory; raises on transient edge-tts errors."""
    communicate = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    audio = bytearray()
    words = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            words.append({
                "text": chunk["text"],
                "offsetMs": chunk["offset"] / 10000,
                "durationMs": chunk["duration"] / 10000,
            })
    if not audio:
        raise RuntimeError("edge-tts returned no audio")
    return bytes(audio), words


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--text", required=True)
    p.add_argument("--voice", default="en-US-ChristopherNeural")
    p.add_argument("--rate", default="+8%")
    p.add_argument("--out", required=True)
    p.add_argument("--boundaries")
    p.add_argument("--retries", type=int, default=4)
    a = p.parse_args()

    # edge-tts (Microsoft's free TTS) occasionally returns transient 503s; retry with backoff.
    last = None
    for attempt in range(a.retries):
        try:
            audio, words = await _synthesize(a.text, a.voice, a.rate)
            break
        except Exception as e:  # noqa: BLE001 - transient network/service errors
            last = e
            if attempt < a.retries - 1:
                await asyncio.sleep(2 * (attempt + 1))
    else:
        raise SystemExit(f"edge-tts failed after {a.retries} attempts: {last}")

    with open(a.out, "wb") as f:
        f.write(audio)
    if a.boundaries:
        with open(a.boundaries, "w") as f:
            json.dump(words, f)
    print(a.out)


if __name__ == "__main__":
    asyncio.run(main())
