"""Step 1: render the narration with each Kokoro voice, plus a ~12 s reference clip per voice.

    ../../.venv-kokoro/bin/python render_kokoro.py
"""

from __future__ import annotations

import json
import sys
import time

import numpy as np
import soundfile as sf

from common import HERE, REFERENCE_SECONDS, REFERENCE_TEXT, SR, VOICES, join_with_pauses, sentences, stem

from kokoro import KPipeline  # noqa: E402


def speak(pipeline: KPipeline, text: str, voice: str) -> np.ndarray:
    chunks = [np.asarray(audio, dtype=np.float32) for _, _, audio in pipeline(text, voice=voice, speed=1.0)]
    return np.concatenate(chunks)


def trim_reference(audio: np.ndarray) -> np.ndarray:
    """Cut at the quietest point near REFERENCE_SECONDS so no word is chopped, then fade out."""
    target = int(REFERENCE_SECONDS * SR)
    if len(audio) <= target:
        return audio
    lo, hi = int((REFERENCE_SECONDS - 1.5) * SR), min(len(audio), int((REFERENCE_SECONDS + 1.0) * SR))
    frame = int(0.02 * SR)
    energy = [np.abs(audio[i:i + frame]).mean() for i in range(lo, hi - frame, frame)]
    cut = lo + int(np.argmin(energy)) * frame
    out = audio[:cut].copy()
    fade = int(0.05 * SR)
    out[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    return out


def main() -> int:
    only = set(sys.argv[1:])
    pipelines = {"a": KPipeline(lang_code="a"), "b": KPipeline(lang_code="b")}
    log = {}
    for number, gender, voice, accent, grade in VOICES:
        if only and voice not in only:
            continue
        pipe = pipelines[voice[0]]
        started = time.perf_counter()
        audio = join_with_pauses([speak(pipe, s, voice) for s in sentences()])
        elapsed = time.perf_counter() - started
        out = HERE / "kokoro" / f"{stem(number, gender, voice)}.wav"
        out.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(out), audio, SR, subtype="PCM_16")

        ref = trim_reference(speak(pipe, REFERENCE_TEXT, voice))
        ref_out = HERE / "references" / f"{voice}.wav"
        ref_out.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(ref_out), ref, SR, subtype="PCM_16")

        seconds = len(audio) / SR
        log[voice] = {"audio_seconds": round(seconds, 2), "generation_seconds": round(elapsed, 2),
                      "realtime_factor": round(elapsed / seconds, 3), "reference_seconds": round(len(ref) / SR, 2)}
        print(voice, log[voice], flush=True)
    path = HERE / "kokoro-render-log.json"
    old = json.loads(path.read_text()) if path.exists() else {}
    old.update(log)
    path.write_text(json.dumps(old, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
