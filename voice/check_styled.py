"""Check a render_styled.py output: transcribe it and measure pitch for each delivery mode.

    python check_styled.py full\\genesis-1-3-essay-style\\test-sections-9-10.wav --scenes 9 10

Runs speech recognition on the CPU so it can run beside a render on the GPU.
Words that differ from the script are listed; a flag may be a recognition error, so listen first.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

VOICE_DIR = Path(__file__).resolve().parent
os.environ.setdefault("HF_HOME", str(VOICE_DIR / ".cache" / "huggingface"))
sys.path.insert(0, str(VOICE_DIR / "voice-demo-analysis" / "pylib"))

import librosa  # noqa: E402
import numpy as np  # noqa: E402
import parselmouth  # noqa: E402
import soundfile as sf  # noqa: E402

import render_full  # noqa: E402
import render_styled  # noqa: E402

# Measured from the voice demo (voice-demo-analysis/analysis2.json).
DEMO = {"overall": 123, "grave (hook)": "97-118", "story (world-building)": "142-159"}


def words(text: str) -> list[str]:
    text = text.lower().replace("-", " ").replace("saviour", "savior")
    return re.findall(r"[a-z']+", text)


def median_f0(path: Path) -> np.ndarray:
    audio, sr = sf.read(str(path), dtype="float32")
    pitch = parselmouth.Sound(audio.astype(np.float64), sampling_frequency=sr).to_pitch_ac(0.01, 60, 400)
    f = pitch.selected_array["frequency"]
    return f[f > 0]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("wav", type=Path)
    parser.add_argument("--script", type=Path, default=render_styled.SCRIPT)
    parser.add_argument("--sections", "--scenes", type=int, nargs="*", default=[])
    parser.add_argument("--ref-dir", type=Path, default=Path(__file__).resolve().parent / "reference" / "capcut-vo")
    parser.add_argument("--name", help="Render folder under full/ (default: the script's file name).")
    parser.add_argument("--device", type=int, default=-1, help="-1 for CPU, 0 for the first GPU.")
    args = parser.parse_args()
    render_styled.use_script(args.script.resolve())
    name = args.name or ("genesis-1-3-own-voice" if args.script.name == "creation-and-the-fall-genesis-1-3-script.md" else args.script.stem)
    render_styled.use_ref_dir(args.ref_dir.resolve(), name)

    scenes = render_styled.read_sections(set(args.sections))
    expected = " ".join(t for n, _, x in scenes for _, t in render_styled.passages(n, x))

    import torch
    from transformers import pipeline

    audio, sr = librosa.load(str(args.wav), sr=16000, mono=True)
    asr = pipeline("automatic-speech-recognition", model="openai/whisper-medium", device=args.device, dtype=torch.float32)
    heard = asr({"raw": audio, "sampling_rate": 16000}, chunk_length_s=30, stride_length_s=5,
                generate_kwargs={"language": "en", "task": "transcribe"})["text"]

    want, got = words(expected), words(heard)
    problems = []
    for op, a1, a2, b1, b2 in SequenceMatcher(None, want, got, autojunk=False).get_opcodes():
        if op != "equal":
            problems.append(f"{op}: script '{' '.join(want[a1:a2])}' -> heard '{' '.join(got[b1:b2])}'")
    print("TRANSCRIPT:", heard.strip())
    print(f"WORD CHECK: {len(problems)} differences in {len(want)} words")
    for p in problems:
        print("  ", p)

    report = json.loads((render_styled.OUT / "passages.json").read_text(encoding="utf-8"))
    wanted = {n for n, _, _ in scenes}
    by_mode = defaultdict(list)
    for name, info in report.items():
        path = render_styled.OUT / "chunks" / name
        if info["section"] in wanted and path.exists() and info["mode"] in render_styled.MODES:
            by_mode[info["mode"]].append(median_f0(path))
    everything = np.concatenate([np.concatenate(v) for v in by_mode.values()])
    print(f"\nPITCH (median Hz) overall {np.median(everything):.0f}  | demo {DEMO}")
    for mode, arrays in sorted(by_mode.items()):
        f = np.concatenate(arrays)
        st = 12 * np.log2(np.percentile(f, 95) / np.percentile(f, 5))
        print(f"  {mode:6} median {np.median(f):5.0f} Hz, range p5-p95 {st:4.1f} semitones, below 85 Hz {100 * (f < 85).mean():4.1f}%  ({len(arrays)} passages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
