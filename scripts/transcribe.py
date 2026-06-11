#!/usr/bin/env python3
"""Transcribe an mp3 to @remotion/captions Caption[] JSON with word timings.
Usage: python scripts/transcribe.py --audio voiceover.mp3 --out captions.json --lang en
"""
import argparse, json
import whisper

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--audio", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--lang", default="en")
    p.add_argument("--model", default="base")
    a = p.parse_args()

    model = whisper.load_model(a.model)
    result = model.transcribe(a.audio, language=a.lang, word_timestamps=True)
    captions = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []):
            start_ms = int(round(w["start"] * 1000))
            end_ms = int(round(w["end"] * 1000))
            captions.append({
                "text": w["word"].strip(),
                "startMs": start_ms,
                "endMs": end_ms,
                "timestampMs": int(round((start_ms + end_ms) / 2)),
                "confidence": w.get("probability", 1),
            })
    with open(a.out, "w") as f:
        json.dump(captions, f, indent=2)
    print(f"{len(captions)} captions -> {a.out}")

if __name__ == "__main__":
    main()
