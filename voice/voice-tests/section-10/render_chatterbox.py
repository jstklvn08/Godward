"""Step 2: render the narration with Chatterbox, using each Kokoro reference clip as audio_prompt_path.

Uses the existing Chatterbox venv (voice/.venv):

    ../../.venv/bin/python render_chatterbox.py
"""

from __future__ import annotations

import json
import sys
import time

import soundfile as sf
import torch

from common import HERE, SR, VOICES, join_with_pauses, sentences, stem

from chatterbox.tts import ChatterboxTTS  # noqa: E402

EXAGGERATION = 0.3
CFG_WEIGHT = 0.5
SEED = 1


def main() -> int:
    only = set(sys.argv[1:])
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("device:", device, flush=True)
    model = ChatterboxTTS.from_pretrained(device=device)
    assert model.sr == SR, model.sr
    path = HERE / "chatterbox-render-log.json"
    log = json.loads(path.read_text()) if path.exists() else {}
    for number, gender, voice, _accent, _grade in VOICES:
        if only and voice not in only:
            continue
        ref = HERE / "references" / f"{voice}.wav"
        started = time.perf_counter()
        model.prepare_conditionals(str(ref), exaggeration=EXAGGERATION)
        parts = []
        for sentence in sentences():
            torch.manual_seed(SEED)
            wav = model.generate(sentence, exaggeration=EXAGGERATION, cfg_weight=CFG_WEIGHT)
            parts.append(wav.squeeze(0).detach().cpu().numpy())
        audio = join_with_pauses(parts)
        elapsed = time.perf_counter() - started
        out = HERE / "chatterbox-cloned" / f"{stem(number, gender, voice)}.wav"
        out.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(out), audio, SR, subtype="PCM_16")
        seconds = len(audio) / SR
        log[voice] = {"device": device, "seed": SEED, "exaggeration": EXAGGERATION, "cfg_weight": CFG_WEIGHT,
                      "audio_seconds": round(seconds, 2), "generation_seconds": round(elapsed, 1),
                      "realtime_factor": round(elapsed / seconds, 2)}
        print(voice, log[voice], flush=True)
        path.write_text(json.dumps(log, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
