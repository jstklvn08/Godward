"""Measure every WAV, transcribe it with faster-whisper, flag word differences, and write README.md's table data.

    ../../.venv-kokoro/bin/python check.py

These are measurements, not a listening test.
"""

from __future__ import annotations

import difflib
import json
import re
import sys
from itertools import combinations

import librosa
import numpy as np
import soundfile as sf

from common import HERE, NARRATION, VOICES, stem

from faster_whisper import WhisperModel  # noqa: E402

SILENCE_DB = -40.0
FRAME = 0.02
NEAR_SEMITONES = 1.0  # medians closer than this count as "nearly identical"


def words(text: str) -> list[str]:
    return re.findall(r"[a-z']+", text.lower().replace("’", "'"))


SCRIPT_WORDS = words(NARRATION)


def measure(path) -> dict:
    audio, sr = sf.read(str(path), dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    n = int(FRAME * sr)
    count = len(audio) // n
    rms = np.sqrt(np.mean(audio[: count * n].reshape(count, n) ** 2, axis=1))
    loud = 20 * np.log10(np.maximum(rms, 1e-9)) > SILENCE_DB
    speech_seconds = float(loud.sum() * FRAME)
    f0, voiced, _ = librosa.pyin(audio, sr=sr, fmin=60, fmax=450, frame_length=2048)
    seconds = len(audio) / sr
    return {
        "seconds": round(seconds, 2),
        "peak_dbfs": round(float(20 * np.log10(max(np.abs(audio).max(), 1e-9))), 1),
        "rms_dbfs": round(float(20 * np.log10(max(np.sqrt(np.mean(audio ** 2)), 1e-9))), 1),
        "speech_fraction": round(float(loud.mean()), 3),
        "non_silent": bool(loud.mean() > 0.3 and np.abs(audio).max() > 0.05),
        "median_pitch_hz": round(float(np.nanmedian(f0[voiced])), 1),
        "words_per_minute": round(len(SCRIPT_WORDS) / seconds * 60, 1),
        "words_per_minute_speech_only": round(len(SCRIPT_WORDS) / speech_seconds * 60, 1),
    }


def word_diff(heard: list[str]) -> list[str]:
    issues = []
    sm = difflib.SequenceMatcher(a=SCRIPT_WORDS, b=heard, autojunk=False)
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op == "equal":
            continue
        said, got = " ".join(SCRIPT_WORDS[a1:a2]), " ".join(heard[b1:b2])
        issues.append({"delete": f"missing: '{said}'", "insert": f"extra: '{got}'",
                       "replace": f"'{said}' -> '{got}'"}[op])
    return issues


def main() -> int:
    whisper = WhisperModel("small.en", device="cpu", compute_type="int8")
    results = []
    for folder in ("kokoro", "chatterbox-cloned", "references"):
        for number, gender, voice, accent, grade in VOICES:
            name = f"{voice}.wav" if folder == "references" else f"{stem(number, gender, voice)}.wav"
            path = HERE / folder / name
            if not path.exists():
                print("MISSING", path, flush=True)
                continue
            row = {"file": f"{folder}/{name}", "folder": folder, "voice": voice, "gender": gender,
                   "accent": accent, "grade": grade, **measure(path)}
            if folder != "references":
                segments, _ = whisper.transcribe(str(path), language="en", beam_size=5)
                text = " ".join(s.text.strip() for s in segments)
                row["transcript"] = text
                row["word_issues"] = word_diff(words(text))
            results.append(row)
            print(json.dumps(row), flush=True)

    pairs = []
    for folder_rows in ("kokoro", "chatterbox-cloned"):
        rows = [r for r in results if r["folder"] == folder_rows]
        for a, b in combinations(rows, 2):
            gap = abs(12 * np.log2(a["median_pitch_hz"] / b["median_pitch_hz"]))
            if gap < NEAR_SEMITONES:
                pairs.append((folder_rows, a["voice"], b["voice"], round(float(gap), 2)))
    both = {(a, b) for f, a, b, _ in pairs if f == "kokoro"} & {(a, b) for f, a, b, _ in pairs if f == "chatterbox-cloned"}
    summary = {"near_pitch_pairs": pairs, "near_in_both": sorted(both)}
    print(json.dumps(summary), flush=True)
    (HERE / "measurements.json").write_text(json.dumps({"files": results, **summary}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
