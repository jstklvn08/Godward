"""Render one script section at several voice settings so they can be compared by ear.

    .venv\\Scripts\\python.exe render_variations.py --script ..\\scripts\\my-script.md --section 10

Every take uses the same seed, so differences come from the settings. Finished files are skipped.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

import render_full
from generate import VOICE_DIR, Narrator, VoiceSetting

VARIATIONS = {
    "deep-documentary-ex0.25-cfg0.40": VoiceSetting(0.25, 0.40),
    "calm-documentary-ex0.30-cfg0.45": VoiceSetting(0.30, 0.45),
    "conversational-ex0.40-cfg0.50": VoiceSetting(0.40, 0.50),
    "weathered-ex0.30-cfg0.40": VoiceSetting(0.30, 0.40),
    "energetic-ex0.55-cfg0.50": VoiceSetting(0.55, 0.50),
}
SEED = 1
GAP = render_full.CHUNK_GAP
PEAK = render_full.PEAK


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--script", type=Path, required=True)
    parser.add_argument("--section", type=int, required=True)
    args = parser.parse_args()

    render_full.SCRIPT = args.script.resolve()
    _, title, text = render_full.read_scenes({args.section})[0]
    passages = render_full.chunk(render_full.to_speech(text))
    out = VOICE_DIR / "variations" / f"section-{args.section:02d}"
    temp = out / "temp"
    temp.mkdir(parents=True, exist_ok=True)
    print(f"Section {args.section}: {title}, {len(passages)} passages", flush=True)

    narrator = None
    for name, setting in VARIATIONS.items():
        final = out / f"{name}.wav"
        if final.exists():
            continue
        narrator = narrator or Narrator()
        pieces, sr = [], None
        for index, passage in enumerate(passages, 1):
            path = temp / f"{name}-{index:02d}.wav"
            if not path.exists():
                stats = narrator.synthesize(passage, setting, path, seed=SEED)
                print(f"{name} [{index}/{len(passages)}] {stats['generation_seconds']}s on {stats['device']}", flush=True)
            audio, sr = sf.read(str(path), dtype="float32")
            pieces.append(render_full.trim(audio, sr))
        gap = np.zeros(int(GAP * sr), dtype=np.float32)
        joined = pieces[0]
        for piece in pieces[1:]:
            joined = np.concatenate([joined, gap, piece])
        joined = joined * (PEAK / float(np.abs(joined).max()))
        sf.write(str(final), joined, sr, subtype="PCM_16")
        words = len(" ".join(passages).split())
        print(f"DONE {name}: {len(joined) / sr:.2f}s, {words / (len(joined) / sr):.2f} words/s", flush=True)
        for path in temp.glob(f"{name}-*.wav"):
            path.unlink()
    return 0


if __name__ == "__main__":
    sys.exit(main())
