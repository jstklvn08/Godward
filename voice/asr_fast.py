"""Whisper through faster-whisper (CTranslate2, int8): many times faster than transformers on a CPU.

check_styled.py, fix_lines.py and align_words.py use it when it is installed
(`pip install faster-whisper`) and the machine has no CUDA GPU; set GODWARD_ASR=transformers to force the
old transformers pipeline. Models download to voice/.cache like the others.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import numpy as np

CACHE = Path(__file__).resolve().parent / ".cache" / "faster-whisper"


def available() -> bool:
    if os.environ.get("GODWARD_ASR") == "transformers":
        return False
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    try:
        import torch
        if torch.cuda.is_available() and os.environ.get("GODWARD_ASR") != "faster":
            return False
    except ImportError:
        pass
    return True


@lru_cache(maxsize=2)
def model(name: str):
    from faster_whisper import WhisperModel
    return WhisperModel(name, device="cpu", compute_type="int8", download_root=str(CACHE),
                        cpu_threads=int(os.environ.get("GODWARD_ASR_THREADS", "0")) or os.cpu_count() or 4)


def short(name: str) -> str:
    """'openai/whisper-small.en' -> 'small.en'."""
    return name.split("/")[-1].removeprefix("whisper-")


def text(audio: np.ndarray, name: str = "medium") -> str:
    """Plain transcript of 16 kHz mono audio."""
    segments, _ = model(short(name)).transcribe(audio.astype(np.float32), language="en", beam_size=1,
                                                vad_filter=False, condition_on_previous_text=False)
    return " ".join(s.text.strip() for s in segments)


def words(audio: np.ndarray, name: str = "small.en") -> list[tuple[str, float, float]]:
    """(word, start, end) for 16 kHz mono audio."""
    kw = {} if short(name).endswith(".en") else {"language": "en"}
    segments, _ = model(short(name)).transcribe(audio.astype(np.float32), beam_size=1, word_timestamps=True,
                                                vad_filter=False, condition_on_previous_text=False, **kw)
    return [(w.word.strip(), float(w.start), float(w.end)) for s in segments for w in (s.words or []) if w.word.strip()]
