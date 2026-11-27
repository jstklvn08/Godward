"""Cut grave/talk/story reference clips for Chatterbox from the narrator's CapCut voice-over.

Source: C:/Users/User/AppData/Local/CapCut/Videos/VO .MP3 (the narrator's own recording, 75 s).
Each clip is one whole passage, cut on word boundaries from a Whisper transcript, loudness-matched
to -20 LUFS and written as 24 kHz mono PCM like reference/tiktok-vo.

    .venv/Scripts/python.exe make_vo_refs.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import librosa
import numpy as np
import pyloudnorm
import soundfile as sf

VOICE_DIR = Path(__file__).resolve().parent
SOURCE = Path(r"C:\Users\User\AppData\Local\CapCut\Videos\VO .MP3")
OUT_DIR = VOICE_DIR / "reference" / "capcut-vo"
SR = 24000

# (name, start s, end s): passages taken from the transcript's word times.
CLIPS = [
    ("story", 0.00, 11.10),   # "Between 1979 and 1995 ... Down, not up."
    ("talk", 33.70, 42.10),   # "Gen Z didn't break the deal ... declined to pretend otherwise."
    ("grave", 60.05, 70.60),  # "Which brings us to the smartest thing ... You substitute."
]


def trim_edges(audio: np.ndarray, sr: int, pad: float = 0.08) -> np.ndarray:
    """Drop leading/trailing quiet left over from loose word times, keeping a short pad."""
    frame = int(0.01 * sr)
    count = len(audio) // frame
    rms = np.sqrt(np.mean(audio[: count * frame].reshape(count, frame) ** 2, axis=1))
    db = 20 * np.log10(np.maximum(rms, 1e-9))
    loud = np.flatnonzero(db > db.max() - 40)
    start = max(0, loud[0] * frame - int(pad * sr))
    end = min(len(audio), (loud[-1] + 1) * frame + int(pad * sr))
    return audio[start:end]


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE
    audio, _ = librosa.load(str(source), sr=SR, mono=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    meter = pyloudnorm.Meter(SR)
    for name, start, end in CLIPS:
        clip = trim_edges(audio[int(start * SR): int(end * SR)], SR)
        clip = pyloudnorm.normalize.loudness(clip, meter.integrated_loudness(clip), -20.0)
        clip = np.clip(clip, -0.99, 0.99)
        fade = int(0.02 * SR)
        clip[:fade] *= np.linspace(0, 1, fade)
        clip[-fade:] *= np.linspace(1, 0, fade)
        sf.write(str(OUT_DIR / f"{name}.wav"), clip, SR, subtype="PCM_16")
        print(f"{name}: {len(clip) / SR:.2f} s")


if __name__ == "__main__":
    main()
