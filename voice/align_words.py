"""Word-level timings for an episode's narration, aligned to the script's own words.

    .venv\\Scripts\\python.exe align_words.py --script ..\\scripts\\my-episode.md --audio full\\my-episode\\my-episode-natural.wav
        --out ..\\videos\\my-episode\\words.js

Writes words.js (`const WORDS=[[word,start,end],...];`, loaded by the episode page before the engine)
and words.json (same data). Words are the SCRIPT's words with its punctuation, so captions read
correctly even where speech recognition mishears ("lolled" -> "called"); times come from Whisper.

How it avoids the first episode's problems:
  * The audio is cut into windows of at most 25 s at quiet points and each window is transcribed on
    its own, so Whisper's 30 s chunk stitching can never drop a stretch (it skipped 63-80 s before).
  * The transcript is aligned to the script with a diff. Matched words take Whisper's times;
    unmatched script words are spread over the time between their matched neighbours.
  * A report lists every unmatched stretch so a person can listen to just those spots.
Model: openai/whisper-small.en on the GPU (fp16, batch 1, fits the 4 GB card), CPU if the GPU fails.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

VOICE_DIR = Path(__file__).resolve().parent
os.environ.setdefault("HF_HOME", str(VOICE_DIR / ".cache" / "huggingface"))

import librosa  # noqa: E402
import numpy as np  # noqa: E402

import render_styled  # noqa: E402

WINDOW = 25.0
SR = 16000


def script_words(script: Path, sections: set[int]) -> list[str]:
    render_styled.use_script(script)
    words = []
    for _, _, text in render_styled.read_sections(sections):
        text = render_styled.TAG.sub("", text)
        text = re.sub(r"\[(grave|talk|story|pivot)\]\s*", "", text)
        text = re.sub(r"\[(beat|pause|hold)\]", "", text)
        words += text.split()
    return words


def norm(word: str) -> str:
    word = word.lower().replace("’", "'").replace("—", " ").replace("–", " ")
    return re.sub(r"[^a-z0-9']", "", word)


def windows(audio: np.ndarray) -> list[tuple[int, int]]:
    """Cut into <= WINDOW s pieces at the quietest 50 ms frame in each piece's last 6 s."""
    hop = int(0.05 * SR)
    frames = len(audio) // hop
    rms = np.sqrt(np.mean(audio[: frames * hop].reshape(frames, hop) ** 2, axis=1))
    cuts, start = [], 0
    while len(audio) - start > WINDOW * SR:
        lo, hi = (start + int((WINDOW - 6) * SR)) // hop, (start + int(WINDOW * SR)) // hop
        cut = (lo + int(np.argmin(rms[lo:hi]))) * hop
        cuts.append((start, cut))
        start = cut
    cuts.append((start, len(audio)))
    return cuts


def transcribe(audio: np.ndarray, model: str) -> list[tuple[str, float, float]]:
    import asr_fast
    if asr_fast.available():
        heard = []
        for a, b in windows(audio):
            heard += [(w, a / SR + s, a / SR + e) for w, s, e in asr_fast.words(audio[a:b], model)]
            print(f"  transcribed {a / SR:6.1f}-{b / SR:6.1f}s (faster-whisper)", flush=True)
        return heard
    import torch
    from transformers import pipeline

    def run(device: int):
        dtype = torch.float16 if device >= 0 else torch.float32
        asr = pipeline("automatic-speech-recognition", model=model, device=device, dtype=dtype)

        def window(a: int, b: int, depth: int = 0) -> list[tuple[str, float, float]]:
            result = asr({"raw": audio[a:b], "sampling_rate": SR}, return_timestamps="word", batch_size=1,
                         generate_kwargs={"num_beams": 1} if model.endswith(".en") else {"num_beams": 1, "language": "en"})
            got = []
            for chunk in result["chunks"]:
                s, e = chunk["timestamp"]
                s = a / SR + (s or 0.0)
                e = a / SR + (e if e is not None else (s - a / SR) + 0.3)
                got += [(w, s, e) for w in chunk["text"].split()]
            seconds = (b - a) / SR
            # Whisper sometimes returns nothing (or a few words) for a window of clear speech.
            # Split it at its quietest point and try the halves, down to 4 s pieces.
            if len(got) < 0.8 * seconds and seconds > 8 and depth < 3:
                hop = int(0.05 * SR)
                mid_lo, mid_hi = a + (b - a) // 3, a + 2 * (b - a) // 3
                frames = audio[mid_lo:mid_hi][: (mid_hi - mid_lo) // hop * hop].reshape(-1, hop)
                cut = mid_lo + int(np.argmin(np.sqrt((frames ** 2).mean(axis=1)))) * hop
                print(f"  only {len(got)} words in {a / SR:.1f}-{b / SR:.1f}s, retrying in two halves", flush=True)
                return window(a, cut, depth + 1) + window(cut, b, depth + 1)
            return got

        heard = []
        for a, b in windows(audio):
            heard += window(a, b)
            print(f"  transcribed {a / SR:6.1f}-{b / SR:6.1f}s", flush=True)
        return heard

    if torch.cuda.is_available():
        try:
            return run(0)
        except RuntimeError as err:
            if "out of memory" not in str(err).lower():
                raise
            print("GPU out of memory, using CPU.", flush=True)
            torch.cuda.empty_cache()
    return run(-1)


def align(script: list[str], heard: list[tuple[str, float, float]], total: float):
    a = [norm(w) for w in script]
    b = [norm(w) for w, _, _ in heard]
    times: list[list[float] | None] = [None] * len(script)
    gaps = []
    for op, i1, i2, j1, j2 in SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal" or (op == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = [heard[j1 + k][1], heard[j1 + k][2]]
            if op == "replace":
                gaps.append(("misheard", " ".join(script[i1:i2]), " ".join(w for w, _, _ in heard[j1:j2]), heard[j1][1]))
        elif op in ("replace", "delete"):
            gaps.append(("filled", " ".join(script[i1:i2]), " ".join(w for w, _, _ in heard[j1:j2]), heard[j1][1] if j1 < len(heard) else total))
    # Fill unmatched script words between known neighbours, weighted by word length.
    i = 0
    while i < len(times):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(times) and times[j] is None:
            j += 1
        left = times[i - 1][1] if i > 0 else 0.0
        right = times[j][0] if j < len(times) else total
        weights = np.array([len(script[k]) + 2 for k in range(i, j)], dtype=float)
        edges = left + np.concatenate([[0], np.cumsum(weights)]) / weights.sum() * max(0.05, right - left)
        for n, k in enumerate(range(i, j)):
            times[k] = [float(edges[n]), float(edges[n] + (edges[n + 1] - edges[n]) * 0.9)]
        i = j
    out, last = [], 0.0
    for word, (s, e) in zip(script, times):
        s = max(s, last)
        e = max(e, s + 0.08)
        out.append([word, round(s, 2), round(e, 2)])
        last = s
    return out, gaps


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--script", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True, help="Path of words.js (words.json is written beside it).")
    parser.add_argument("--sections", type=int, nargs="*", default=[], help="Only these sections (when the audio is a partial render).")
    parser.add_argument("--model", default="openai/whisper-small.en")
    args = parser.parse_args()

    words = script_words(args.script.resolve(), set(args.sections))
    audio, _ = librosa.load(str(args.audio), sr=SR, mono=True)
    total = len(audio) / SR
    print(f"{len(words)} script words, {total:.1f}s of audio", flush=True)
    heard = transcribe(audio, args.model)
    aligned, gaps = align(words, heard, total)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(aligned, ensure_ascii=False, separators=(",", ":"))
    args.out.write_text(f"// Word timings for {args.audio.name}, aligned to {args.script.name} by align_words.py.\nconst WORDS={body};\n", encoding="utf-8")
    args.out.with_suffix(".json").write_text(body, encoding="utf-8")

    matched = len(words) - sum(len(g[1].split()) for g in gaps if g[0] == "filled")
    print(f"DONE {args.out}: {len(aligned)} words, {matched / len(words):.1%} timed directly by Whisper, last word ends {aligned[-1][2]:.2f}s")
    for kind, said, heard_text, at in gaps:
        print(f"  {kind:8} at {at:6.1f}s  script: {said!r}  heard: {heard_text!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
