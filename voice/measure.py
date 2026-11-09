"""Measure generated WAVs: duration, loudness, speech coverage, pauses and pitch range.

These numbers show that real audio exists and how it is paced. They do not judge quality.

    .venv\\Scripts\\python.exe measure.py clips comparison
"""

from __future__ import annotations

import sys
from pathlib import Path

import librosa
import numpy as np
import perth
import soundfile as sf

FRAME_SECONDS = 0.02
SILENCE_DB = -40.0
MIN_PAUSE_SECONDS = 0.18


def measure(path: Path, watermarker) -> dict:
    audio, sr = sf.read(str(path), dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    frame = int(FRAME_SECONDS * sr)
    count = len(audio) // frame
    rms = np.sqrt(np.mean(audio[: count * frame].reshape(count, frame) ** 2, axis=1))
    db = 20 * np.log10(np.maximum(rms, 1e-9))
    loud = db > SILENCE_DB

    pauses, run = [], None
    for i, is_loud in enumerate(loud):
        if not is_loud and run is None:
            run = i
        elif is_loud and run is not None:
            if (i - run) * FRAME_SECONDS >= MIN_PAUSE_SECONDS and run > 0:
                pauses.append((round(run * FRAME_SECONDS, 2), round(i * FRAME_SECONDS, 2)))
            run = None

    f0, voiced, _ = librosa.pyin(audio, sr=sr, fmin=65, fmax=400, frame_length=2048)
    semitones = 12 * np.log2(f0[voiced] / np.nanmedian(f0[voiced]))
    return {
        "file": str(path),
        "seconds": round(len(audio) / sr, 3),
        "sample_rate": sr,
        "peak_dbfs": round(float(20 * np.log10(max(np.abs(audio).max(), 1e-9))), 1),
        "rms_dbfs": round(float(20 * np.log10(max(np.sqrt(np.mean(audio**2)), 1e-9))), 1),
        "speech_fraction": round(float(loud.mean()), 3),
        "ends_of_speech_s": round(float(np.flatnonzero(loud)[-1] * FRAME_SECONDS), 2) if loud.any() else None,
        "pauses_s": pauses,
        "pitch_median_hz": round(float(np.nanmedian(f0[voiced])), 1),
        "pitch_spread_semitones": round(float(np.nanstd(semitones)), 2),
        "watermark": float(watermarker.get_watermark(audio, sample_rate=sr)),
    }


def main() -> int:
    watermarker = perth.PerthImplicitWatermarker()
    folders = sys.argv[1:] or ["clips", "comparison"]
    root = Path(__file__).resolve().parent
    for folder in folders:
        for path in sorted((root / folder).glob("*.wav")):
            print(measure(path, watermarker))
    return 0


if __name__ == "__main__":
    sys.exit(main())
