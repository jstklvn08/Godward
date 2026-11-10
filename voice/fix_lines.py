"""Re-render single passages that came out with wrong words, checking each new take by ear-proxy.

    python fix_lines.py --ref-dir reference/own-voice 8.2 9.2

For each section.index given, tries seeds 4-9 with the same mode setting and reference,
transcribes each take with whisper, and keeps the first take whose words match the script
and whose pace is inside the mode's range (or the closest matching take). It overwrites the
passage's chunk file and passages.json entry, so the next render_styled.py run uses it.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

VOICE_DIR = Path(__file__).resolve().parent
os.environ.setdefault("HF_HOME", str(VOICE_DIR / ".cache" / "huggingface"))

import librosa  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from transformers import pipeline  # noqa: E402

import render_full  # noqa: E402
import render_styled as r  # noqa: E402
from generate import Narrator  # noqa: E402
import asr_fast  # noqa: E402

SEEDS = range(4, 10)


def words(text: str) -> list[str]:
    return re.findall(r"[a-z']+", text.lower())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("targets", nargs="+", help="section.index, e.g. 8.2")
    parser.add_argument("--script", type=Path, default=r.SCRIPT)
    parser.add_argument("--ref-dir", type=Path, default=VOICE_DIR / "reference" / "own-voice")
    parser.add_argument("--name", help="Render folder under full/ (default: the script's file name).")
    parser.add_argument("--seeds", default="4-9", help="Seed range to try, e.g. 10-29.")
    args = parser.parse_args()
    first, last = map(int, args.seeds.split("-"))
    seeds = range(first, last + 1)
    r.use_script(args.script.resolve())
    name = args.name or ("genesis-1-3-own-voice" if args.script.name == "creation-and-the-fall-genesis-1-3-script.md" else args.script.stem)
    r.use_ref_dir(args.ref_dir.resolve(), name)
    report_path = r.OUT / "passages.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if asr_fast.available():
        def asr(item, generate_kwargs=None):
            return {"text": asr_fast.text(item["raw"], "medium")}
    else:
        asr = pipeline("automatic-speech-recognition", model="openai/whisper-medium", device=-1, dtype=torch.float32)
    narrator = Narrator()

    for target in args.targets:
        section, index = map(int, target.split("."))
        _, _, text = r.read_sections({section})[0]
        mode, line = r.passages(section, text)[index - 1]
        chunk = next(p for p in (r.OUT / "chunks").glob(f"s{section:02d}-{index:02d}-{mode}-*.wav") if ".seed" not in p.name)
        low, high = r.PACE[mode]
        print(f"{target} {mode}: {line}  ->  {chunk.name}", flush=True)
        best = None
        for seed in seeds:
            attempt = chunk.with_suffix(f".fix{seed}.wav")
            narrator.synthesize(line, r.MODES[mode], attempt, seed=seed, voice_ref=r.MODE_REF.get(mode, r.DEFAULT_REF))
            audio, sr = sf.read(str(attempt), dtype="float32")
            wps = len(line.split()) / (len(render_full.trim(audio, sr)) / sr)
            heard = asr({"raw": librosa.resample(audio, orig_sr=sr, target_sr=16000), "sampling_rate": 16000},
                        generate_kwargs={"language": "en", "task": "transcribe"})["text"]
            match = words(heard) == words(line) or asr_fast.squash(heard) == asr_fast.squash(line)
            print(f"  seed {seed}: {wps:.2f} words/s, heard '{heard.strip()}' {'MATCH' if match else ''}", flush=True)
            score = (match, low <= wps <= high, -abs(wps - (low + high) / 2))
            if best is None or score > best[0]:
                best = (score, attempt, seed, wps)
            if match and low <= wps <= high:
                break
        if not best[0][0]:
            # Never swap in a take whose words are wrong; keep the existing one.
            for leftover in chunk.parent.glob(f"{chunk.stem}.fix*.wav"):
                leftover.unlink()
            print(f"  NO take matched; kept the existing passage", flush=True)
            continue
        best[1].replace(chunk)
        for leftover in chunk.parent.glob(f"{chunk.stem}.fix*.wav"):
            leftover.unlink()
        report[chunk.name] = {"section": section, "mode": mode, "text": line, "seed": best[2],
                              "words_per_second": round(best[3], 2), "in_range": bool(low <= best[3] <= high),
                              "word_check": "match" if best[0][0] else "no match"}
        report_path.write_text(json.dumps(report, indent=1), encoding="utf-8")
        print(f"  KEPT seed {best[2]}: {'words match' if best[0][0] else 'NO take matched'}, {best[3]:.2f} words/s", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
