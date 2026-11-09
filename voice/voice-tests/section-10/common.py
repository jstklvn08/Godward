"""Shared settings for the section 10 voice test (Kokoro voices and Chatterbox with Kokoro references)."""

from __future__ import annotations

import os
import re
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
VOICE_DIR = HERE.parents[1]
# Keep model downloads inside voice/.cache (gitignored), not the user profile.
os.environ.setdefault("HF_HOME", str(VOICE_DIR / ".cache" / "huggingface"))

SR = 24000
PAUSE_SECONDS = 0.3

NARRATION = (
    "The serpent was cursed to crawl on its belly. "
    "God put hostility between it and the woman, and between their offspring. "
    "He will crush your head, and you will strike his heel. "
    "Christians have long read this as the first hint of a Savior. "
    "The woman would have greatly increased pain in childbearing, and conflict in her marriage. "
    "The man would work cursed ground through painful toil, among thorns and thistles, until death. "
    "For dust you are and to dust you will return."
)

# Neutral, non-scripture text used only to make the ~12 s Chatterbox reference clips.
REFERENCE_TEXT = (
    "Long ago, before the cities and the roads, people told stories by the fire at night. "
    "Some stories were about the stars, and some were about the rivers and the hills. "
    "Each one was passed from parent to child, slowly, carefully, and with great patience."
)
REFERENCE_SECONDS = 12.0

# (number, gender, voice id, accent, Kokoro overall grade from VOICES.md)
VOICES = [
    (1, "female", "af_heart", "American", "A"),
    (2, "female", "af_bella", "American", "A-"),
    (3, "female", "bf_emma", "British", "B-"),
    (4, "female", "bf_isabella", "British", "C"),
    (5, "female", "af_sarah", "American", "C+"),
    (6, "male", "am_michael", "American", "C+"),
    (7, "male", "am_fenrir", "American", "C+"),
    (8, "male", "am_puck", "American", "C+"),
    (9, "male", "bm_george", "British", "C"),
    (10, "male", "bm_fable", "British", "C"),
]


def sentences(text: str = NARRATION) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def stem(number: int, gender: str, voice: str) -> str:
    return f"{number:02d}-{gender}-{voice}"


def join_with_pauses(parts: list[np.ndarray]) -> np.ndarray:
    gap = np.zeros(int(PAUSE_SECONDS * SR), dtype=np.float32)
    out = []
    for i, part in enumerate(parts):
        if i:
            out.append(gap)
        out.append(np.asarray(part, dtype=np.float32).reshape(-1))
    return np.concatenate(out)
