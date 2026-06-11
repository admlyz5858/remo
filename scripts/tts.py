#!/usr/bin/env python3
"""Synthesize one chunk of text to mp3 with edge-tts.
Usage: python scripts/tts.py --text "..." --voice en-US-ChristopherNeural --rate "+8%" --out file.mp3
"""
import argparse, asyncio
import edge_tts

async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--text", required=True)
    p.add_argument("--voice", default="en-US-ChristopherNeural")
    p.add_argument("--rate", default="+8%")
    p.add_argument("--out", required=True)
    a = p.parse_args()
    communicate = edge_tts.Communicate(a.text, a.voice, rate=a.rate)
    await communicate.save(a.out)
    print(a.out)

if __name__ == "__main__":
    asyncio.run(main())
