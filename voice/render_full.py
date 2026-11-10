"""Render the full narration from a script's "> " lines, one short passage at a time.

    .venv\\Scripts\\python.exe render_full.py              # every scene
    .venv\\Scripts\\python.exe render_full.py --scenes 1   # just Scene 1 (a quick test)

Finished passages are kept in full/<name>/chunks, so an interrupted run resumes where it
stopped. A passage is retried with a new seed if its pace suggests dropped or stretched words.
Writes one WAV per scene, one full WAV and timings.json with each scene's start and end.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

from generate import PRESETS, VOICE_DIR, Narrator

SCRIPT = VOICE_DIR.parent / "scripts" / "creation-and-the-fall-full-script.md"
OUT = VOICE_DIR / "full" / "creation-and-the-fall"
PRESET = "restrained"

MAX_CHARS = 110  # Longer passages come out rushed.
MERGE_CHARS = 60
SEEDS = (1, 2, 3)
MIN_WPS, MAX_WPS = 2.2, 3.9
SILENCE_DB = -45.0
EDGE_PAD = 0.04
CHUNK_GAP = 0.32
SCENE_GAP = 0.8
PEAK = 10 ** (-1.0 / 20)

# Spelling hints so the model says names and old words correctly. The script itself is unchanged.
SAY = {
    "Subtil": "Subtle",
    "subtil": "subtle",
    "Hiddekel": "Hid-deh-kel",
    "Pison": "Pie-son",
    "Gihon": "Guy-hon",
    "Cherubims": "Cherubim",
}


def read_scenes(only: set[int]) -> list[tuple[int, str, str]]:
    source = SCRIPT.read_text(encoding="utf-8")
    pattern = re.compile(r"^## (?:Scene )?(\d+)[:.] (.+?)$(.*?)^> (.+?)$", re.M | re.S)
    scenes = [(int(m[1]), m[2].strip(), m[4].strip()) for m in pattern.finditer(source)]
    return [s for s in scenes if not only or s[0] in only]


def to_speech(text: str) -> str:
    text = text.replace("“", "").replace("”", "").replace("...?", "?")
    for word, spoken in SAY.items():
        text = re.sub(rf"\b{word}\b", spoken, text)
    return re.sub(r"\s+", " ", text).strip()


def split_long(sentence: str) -> list[str]:
    if len(sentence) <= MAX_CHARS:
        return [sentence]
    parts, current = [], ""
    for piece in re.split(r"(?<=[;:,])\s+", sentence):
        if current and len(current) + len(piece) + 1 > MAX_CHARS:
            parts.append(current)
            current = piece
        else:
            current = f"{current} {piece}".strip()
    return parts + ([current] if current else [])


def chunk(text: str) -> list[str]:
    sentences = [p for s in re.split(r"(?<=[.?!])\s+", text) for p in split_long(s)]
    chunks, current = [], ""
    for sentence in sentences:
        # Only very short sentences are joined, because longer joins come out rushed.
        if current and len(current) + len(sentence) + 1 > MERGE_CHARS:
            chunks.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    return chunks + ([current] if current else [])


def trim(audio: np.ndarray, sr: int) -> np.ndarray:
    frame = int(0.01 * sr)
    count = len(audio) // frame
    rms = np.sqrt(np.mean(audio[: count * frame].reshape(count, frame) ** 2, axis=1))
    loud = np.flatnonzero(20 * np.log10(np.maximum(rms, 1e-9)) > SILENCE_DB)
    if not len(loud):
        return audio
    pad = int(EDGE_PAD * sr)
    return audio[max(0, loud[0] * frame - pad) : min(len(audio), (loud[-1] + 1) * frame + pad)]


def render_chunk(narrator: Narrator, text: str, path: Path) -> dict:
    words = len(text.split())
    target = (MIN_WPS + MAX_WPS) / 2
    best = None
    for seed in SEEDS:
        attempt = path.with_suffix(f".seed{seed}.wav")
        stats = narrator.synthesize(text, PRESETS[PRESET], attempt, seed=seed)
        audio, sr = sf.read(str(attempt), dtype="float32")
        wps = words / (len(trim(audio, sr)) / sr)
        print(f"  seed {seed}: {wps:.2f} words/s on {stats['device']}, {stats['generation_seconds']}s", flush=True)
        if best is None or abs(wps - target) < abs(best[1] - target):
            best = (attempt, wps, seed)
        if MIN_WPS <= wps <= MAX_WPS:
            break
    best[0].replace(path)
    for leftover in path.parent.glob(f"{path.stem}.seed*.wav"):
        leftover.unlink()
    return {"seed": best[2], "words_per_second": round(best[1], 2), "in_range": bool(MIN_WPS <= best[1] <= MAX_WPS)}


def main() -> int:
    global SCRIPT, OUT
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenes", type=int, nargs="*", default=[])
    parser.add_argument("--script", type=Path, default=SCRIPT, help="Markdown script with '> ' narration lines.")
    parser.add_argument("--name", default=OUT.name, help="Folder name under full/, also used for the final WAV.")
    args = parser.parse_args()

    SCRIPT, OUT = args.script.resolve(), VOICE_DIR / "full" / args.name

    scenes = read_scenes(set(args.scenes))
    chunks_dir = OUT / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    report_path = OUT / "chunks.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    narrator = None
    sr = None
    built = []
    used = set()

    total = sum(len(chunk(to_speech(text))) for _, _, text in scenes)
    done = 0
    for number, title, text in scenes:
        pieces = []
        for index, passage in enumerate(chunk(to_speech(text)), 1):
            digest = hashlib.md5(f"{PRESET}|{passage}".encode()).hexdigest()[:6]
            path = chunks_dir / f"s{number:02d}-{index:02d}-{digest}.wav"
            done += 1
            used.add(path.name)
            if not path.exists():
                print(f"[{done}/{total}] Scene {number}.{index}: {passage}", flush=True)
                narrator = narrator or Narrator()
                report[path.name] = {"text": passage, **render_chunk(narrator, passage, path)}
                report_path.write_text(json.dumps(report, indent=1), encoding="utf-8")
            audio, sr = sf.read(str(path), dtype="float32")
            pieces.append(trim(audio, sr))
        gap = np.zeros(int(CHUNK_GAP * sr), dtype=np.float32)
        joined = pieces[0]
        for piece in pieces[1:]:
            joined = np.concatenate([joined, gap, piece])
        built.append((number, title, joined))

    peak = max(float(np.abs(a).max()) for _, _, a in built)
    gain = PEAK / peak
    scenes_dir = OUT / "scenes"
    scenes_dir.mkdir(exist_ok=True)
    timings, cursor, full = [], 0.0, []
    scene_gap = np.zeros(int(SCENE_GAP * sr), dtype=np.float32)
    for i, (number, title, audio) in enumerate(built):
        audio = audio * gain
        sf.write(str(scenes_dir / f"scene-{number:02d}.wav"), audio, sr, subtype="PCM_16")
        seconds = len(audio) / sr
        timings.append({"scene": number, "title": title, "start": round(cursor, 2), "end": round(cursor + seconds, 2), "seconds": round(seconds, 2)})
        full.append(audio)
        cursor += seconds
        if i < len(built) - 1:
            full.append(scene_gap)
            cursor += SCENE_GAP

    if not args.scenes:
        sf.write(str(OUT / f"{args.name}-full.wav"), np.concatenate(full), sr, subtype="PCM_16")
        (OUT / "timings.json").write_text(json.dumps(timings, indent=1), encoding="utf-8")

    flagged = [v["text"] for k, v in report.items() if k in used and not v["in_range"]]
    print(f"DONE scenes={len(built)} seconds={cursor:.1f} minutes={cursor / 60:.2f} flagged={len(flagged)}", flush=True)
    for text in flagged:
        print("FLAGGED:", text, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
