"""Run Resemble's Perth watermark detector over the Kokoro and Chatterbox takes.

    ../../.venv/bin/python watermark_check.py
"""
import json
import sys

import librosa
import perth

from common import HERE, VOICES, stem

wm = perth.PerthImplicitWatermarker()
out = {}
for folder in ("kokoro", "chatterbox-cloned"):
    for number, gender, voice, *_ in VOICES:
        path = HERE / folder / f"{stem(number, gender, voice)}.wav"
        audio, sr = librosa.load(str(path), sr=None)
        out[f"{folder}/{path.name}"] = float(wm.get_watermark(audio, sample_rate=sr))
        print(f"{folder}/{path.name}", out[f"{folder}/{path.name}"], flush=True)
(HERE / "watermark.json").write_text(json.dumps(out, indent=2))
sys.exit(0)
