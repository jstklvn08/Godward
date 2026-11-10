"""Render an episode script's narration in the narrator's own voice, sentence by sentence.

    .venv\\Scripts\\python.exe render_styled.py --script ..\\scripts\\my-episode.md --ref-dir reference\\own-voice --natural
    .venv\\Scripts\\python.exe render_styled.py --script ... --ref-dir ... --sections 3 4    # test a few sections
    .venv\\Scripts\\python.exe render_styled.py --script ... --plan                         # show modes and pauses only

Script format (see .claude/skills/godward-episode/reference/script.md):
    ## 3. Section title
    > [grave] In the beginning, God created the heavens and the earth. [pause]
    > [story] On the first day, there was light.
Every "> " line in a section is narration. A tag at the start of a sentence sets its delivery mode:
  [grave] low and slow, for the heaviest lines and scripture
  [talk]  conversational commentary
  [story] storytelling (the default)
  [pivot] short turning points such as "But God wasn't finished."
[beat] 0.3 s, [pause] 0.8 s and [hold] 1.5 s add silence after a sentence. Tags are never spoken.
An optional sidecar <script>.voice.json can set "section_mode" ({"1": "grave"}), "overrides"
(sentence start -> mode, for scripts without tags) and "say" (spelling -> how to pronounce it).

Each sentence is rendered with Chatterbox using the reference clip for its mode (grave.wav,
talk.wav, story.wav, optional pivot.wav), retried over seeds until its pace fits the mode.
Finished passages are cached by content in full/<name>/chunks, so reruns only render changes.
--natural gives the slower, human edit used for the first episode (recommended); without it
the edit is tight like the voice demo. Outputs: full/<name>/<name>[-natural].wav, a timings
JSON (section starts and ends), scenes[-natural]/section-NN.wav and passages.json.
Then run align_words.py on the WAV to get word timings for the video.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import lfilter

import render_full
from generate import VOICE_DIR, Narrator, VoiceSetting

import parselmouth  # noqa: E402
import pyloudnorm  # noqa: E402
from parselmouth.praat import call  # noqa: E402

SCRIPT = VOICE_DIR.parent / "scripts" / "creation-and-the-fall-genesis-1-3-script.md"
OUT = VOICE_DIR / "full" / "genesis-1-3-own-voice"
MODE_REF: dict[str, Path] = {}
DEFAULT_REF = Path()

# Settings for the narrator's own clips (own-voice references carry a natural pace and the
# right delivery per mode). Tested on Creation: grave 0.40/0.40 gave 3.2-3.8 words/s and talk
# 0.50/0.50 gave 4.4-5.1 words/s (its clip is the demo's quickest line), so both are lower.
MODES = {
    "grave": VoiceSetting(0.35, 0.30, 0.7),
    "talk": VoiceSetting(0.40, 0.30, 0.8),
    "story": VoiceSetting(0.50, 0.50, 0.8),
    "pivot": VoiceSetting(0.60, 0.50, 0.8),
}
# Words per second accepted for each mode, measured after trimming the ends.
PACE = {"grave": (1.9, 2.9), "talk": (2.7, 3.9), "story": (2.4, 3.6), "pivot": (2.0, 4.2)}
SEEDS = (1, 2, 3)
TAG = re.compile(r"^\[(grave|talk|story|pivot)\]\s*")
MARKERS = {"[beat]": 0.3, "[pause]": 0.8, "[hold]": 1.5}

SECTION_MODE: dict[int, str] = {}
OVERRIDES: dict[str, str] = {}

MERGE_CHARS = 60  # Only very short sentences in the same mode are joined.
INNER_PAUSE_MAX = 0.12  # Tight edit: pauses inside a passage longer than this ...
INNER_PAUSE_KEEP = 0.07  # ... are cut down to this.
SENTENCE_GAP = 0.08
SECTION_GAP = 0.5
TARGET_LUFS = -14.0
PEAK = 10 ** (-1.0 / 20)

# --natural: slower, more human edit. Each line is lengthened with Praat's overlap-add (pitch and
# voice kept), commas keep a real breath, gaps depend on the line before and vary slightly,
# sections get a full pause, and silence is filled with a faint room tone instead of zero.
NATURAL = False
STRETCH = {"grave": 1.15, "talk": 1.06, "story": 1.06, "pivot": 1.0}
GAP_AFTER = {"grave": 0.65, "talk": 0.42, "story": 0.45, "pivot": 0.5}
PIVOT_BEAT = 0.15
GAP_JITTER = 0.08
NATURAL_SECTION_GAP = 1.1
NATURAL_PAUSE_MAX, NATURAL_PAUSE_KEEP = 0.45, 0.35
ROOM_TONE_DB = -50


def use_ref_dir(ref_dir: Path, name: str) -> None:
    """Use one clip per mode from ref_dir (grave.wav, talk.wav, story.wav, optional pivot.wav)."""
    global OUT, DEFAULT_REF
    OUT = VOICE_DIR / "full" / name
    MODE_REF.clear()
    for mode in MODES:
        if (ref_dir / f"{mode}.wav").exists():
            MODE_REF[mode] = ref_dir / f"{mode}.wav"
    DEFAULT_REF = ref_dir / "story.wav"
    if not DEFAULT_REF.exists():
        sys.exit(f"{ref_dir} needs at least story.wav (and ideally grave.wav and talk.wav).")


def use_script(script: Path) -> None:
    """Point at a script and load its optional <script>.voice.json sidecar."""
    global SCRIPT, SENTENCE_GAP
    SCRIPT = script
    render_full.SCRIPT = script
    sidecar = script.with_suffix(".voice.json")
    if sidecar.exists():
        data = json.loads(sidecar.read_text(encoding="utf-8"))
        SECTION_MODE.update({int(k): v for k, v in data.get("section_mode", {}).items()})
        OVERRIDES.update(data.get("overrides", {}))
        render_full.SAY.update(data.get("say", {}))
        # Optional per-episode delivery: "modes": {"story": [exaggeration, cfg, temperature]},
        # "pace": {"story": [low, high]} words/s, "sentence_gap": seconds (tight edit).
        for mode, values in data.get("modes", {}).items():
            MODES[mode] = VoiceSetting(*values)
        for mode, window in data.get("pace", {}).items():
            PACE[mode] = tuple(window)
        if "sentence_gap" in data:
            SENTENCE_GAP = float(data["sentence_gap"])


def read_sections(only: set[int]) -> list[tuple[int, str, str]]:
    """(number, title, narration) for each '## N. Title' section; every '> ' line is narration."""
    source = SCRIPT.read_text(encoding="utf-8")
    if "{{ESV " in source:
        sys.exit(f"{SCRIPT.name} has ESV references. Run scripts/fill_esv.py on it and render the .esv.md copy.")
    sections = []
    for match in re.finditer(r"^## (?:Scene )?(\d+)[:.] (.+?)$(.*?)(?=^## |\Z)", source, re.M | re.S):
        lines = [line[2:].strip() for line in match.group(3).splitlines() if line.startswith("> ")]
        if lines:
            sections.append((int(match.group(1)), match.group(2).strip(), " ".join(lines)))
    return [s for s in sections if not only or s[0] in only]


def mode_of(section: int, sentence: str) -> tuple[str, str]:
    tag = TAG.match(sentence)
    if tag:
        return tag.group(1), sentence[tag.end():]
    for start, mode in OVERRIDES.items():
        if sentence.startswith(start):
            return mode, sentence
    return SECTION_MODE.get(section, "story"), sentence


def passages(section: int, text: str) -> list[tuple[str, str]]:
    return [(mode, line) for mode, line, _ in passages_with_pauses(section, text)]


def passages_with_pauses(section: int, text: str) -> list[tuple[str, str, float]]:
    """(mode, spoken text, extra pause after) for each passage; pause markers become pauses."""
    marker = re.compile("|".join(re.escape(m) for m in MARKERS))
    out: list[list] = []
    # Clean the text first (quotes, pronunciations), then split, so sentences ending in a quote split.
    # Also split after a pause marker, so a marker at the end of a line pauses after that sentence, not the next.
    for sentence in re.split(r"(?<=[.?!])\s+|(?<=\[beat\])\s+|(?<=\[pause\])\s+|(?<=\[hold\])\s+", render_full.to_speech(text)):
        extra = sum(MARKERS[m] for m in marker.findall(sentence))
        sentence = marker.sub("", sentence).strip()
        if not sentence:
            if out:
                out[-1][2] += extra
            continue
        mode, sentence = mode_of(section, sentence)
        for piece in render_full.split_long(sentence):
            if out and out[-1][0] == mode and out[-1][2] == 0 and len(out[-1][1]) + len(piece) + 1 <= MERGE_CHARS:
                out[-1][1] = f"{out[-1][1]} {piece}"
            else:
                out.append([mode, piece, 0.0])
        out[-1][2] += extra
    return [tuple(p) for p in out]


def tighten(audio: np.ndarray, sr: int, max_pause: float | None = None, keep_pause: float | None = None) -> np.ndarray:
    """Cut breaths and long pauses inside a passage down to a short gap."""
    max_pause = INNER_PAUSE_MAX if max_pause is None else max_pause
    keep_pause = INNER_PAUSE_KEEP if keep_pause is None else keep_pause
    frame = int(0.01 * sr)
    count = len(audio) // frame
    rms = np.sqrt(np.mean(audio[: count * frame].reshape(count, frame) ** 2, axis=1))
    quiet = 20 * np.log10(np.maximum(rms, 1e-9)) < 20 * np.log10(np.abs(audio).max() + 1e-9) - 35
    keep = int(keep_pause / 0.01)
    pieces, start, i = [], 0, 0
    while i < count:
        if quiet[i]:
            j = i
            while j < count and quiet[j]:
                j += 1
            if (j - i) * 0.01 > max_pause and i > 0 and j < count:
                pieces.append(audio[start:(i + keep // 2) * frame])
                start = (j - keep // 2) * frame
            i = j
        else:
            i += 1
    pieces.append(audio[start:])
    return np.concatenate(pieces)


def ref_tag(ref: Path) -> str:
    return f"{ref.parent.name}/{ref.name}"


def lengthen(audio: np.ndarray, sr: int, factor: float) -> np.ndarray:
    """Slow a passage down by factor, keeping pitch and voice (Praat overlap-add)."""
    if abs(factor - 1.0) < 1e-3:
        return audio
    sound = parselmouth.Sound(audio.astype(np.float64), sampling_frequency=sr)
    return call(sound, "Lengthen (overlap-add)", 60, 400, factor).values[0].astype(np.float32)


def room_tone(length: int, level: float) -> np.ndarray:
    noise = np.random.default_rng(7).standard_normal(length)
    noise = lfilter([1.0], [1.0, -0.9], noise)
    return (noise / noise.std() * level).astype(np.float32)


def render_passage(narrator: Narrator, mode: str, text: str, path: Path) -> dict:
    words = len(text.split())
    low, high = PACE[mode]
    target = (low + high) / 2
    best = None
    for seed in SEEDS:
        attempt = path.with_suffix(f".seed{seed}.wav")
        stats = narrator.synthesize(text, MODES[mode], attempt, seed=seed, voice_ref=MODE_REF.get(mode, DEFAULT_REF))
        audio, sr = sf.read(str(attempt), dtype="float32")
        wps = words / (len(render_full.trim(audio, sr)) / sr)
        print(f"  {mode} seed {seed}: {wps:.2f} words/s, {stats['generation_seconds']}s on {stats['device']}", flush=True)
        if best is None or abs(wps - target) < abs(best[1] - target):
            best = (attempt, wps, seed)
        if low <= wps <= high:
            break
    best[0].replace(path)
    for leftover in path.parent.glob(f"{path.stem}.seed*.wav"):
        leftover.unlink()
    return {"seed": best[2], "words_per_second": round(best[1], 2), "in_range": bool(low <= best[1] <= high)}


def biquad_shelf(sr: int, freq: float, gain_db: float, high: bool):
    """RBJ cookbook shelf filter, slope 1."""
    a = 10 ** (gain_db / 40)
    w = 2 * np.pi * freq / sr
    alpha = np.sin(w) / 2 * np.sqrt(2)
    cos, sq = np.cos(w), 2 * np.sqrt(a) * alpha
    if high:
        b = [a * ((a + 1) + (a - 1) * cos + sq), -2 * a * ((a - 1) + (a + 1) * cos), a * ((a + 1) + (a - 1) * cos - sq)]
        d = [(a + 1) - (a - 1) * cos + sq, 2 * ((a - 1) - (a + 1) * cos), (a + 1) - (a - 1) * cos - sq]
    else:
        b = [a * ((a + 1) - (a - 1) * cos + sq), 2 * a * ((a - 1) - (a + 1) * cos), a * ((a + 1) - (a - 1) * cos - sq)]
        d = [(a + 1) + (a - 1) * cos + sq, -2 * ((a - 1) + (a + 1) * cos), (a + 1) + (a - 1) * cos - sq]
    return np.array(b) / d[0], np.array(d) / d[0]


def master(audio: np.ndarray, sr: int) -> np.ndarray:
    # Darker and closer, like the voice demo: less top end, a little more low end.
    for freq, gain, high in ((4000, -4.0, True), (150, 2.0, False)):
        b, a = biquad_shelf(sr, freq, gain, high)
        audio = lfilter(b, a, audio).astype(np.float32)
    loudness = pyloudnorm.Meter(sr).integrated_loudness(audio)
    audio = audio * 10 ** ((TARGET_LUFS - loudness) / 20)
    window = max(1, int(0.005 * sr))
    env = maximum_filter1d(np.abs(audio), size=window)
    gain = np.minimum(1.0, PEAK / np.maximum(env, 1e-9))
    gain = uniform_filter1d(minimum_filter1d(gain, size=window * 4), size=window * 4)
    return np.clip(audio * gain, -PEAK, PEAK).astype(np.float32)


def main() -> int:
    global NATURAL
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--script", type=Path, default=SCRIPT)
    parser.add_argument("--ref-dir", type=Path, default=VOICE_DIR / "reference" / "own-voice")
    parser.add_argument("--name", help="Output folder under full/ (default: the script's file name).")
    parser.add_argument("--sections", "--scenes", type=int, nargs="*", default=[])
    parser.add_argument("--natural", action="store_true", help="Slower, human edit (recommended).")
    parser.add_argument("--plan", action="store_true", help="Print each passage's mode and pause, render nothing.")
    args = parser.parse_args()
    NATURAL = args.natural

    use_script(args.script.resolve())
    name = args.name or ("genesis-1-3-own-voice" if args.script.name == "creation-and-the-fall-genesis-1-3-script.md" else args.script.stem)
    use_ref_dir(args.ref_dir.resolve(), name)
    scenes = read_sections(set(args.sections))
    plan = [(n, title, passages_with_pauses(n, text)) for n, title, text in scenes]
    if args.plan:
        for number, title, parts in plan:
            print(f"## {number}. {title}")
            for mode, text, extra in parts:
                print(f"  {mode:5} {'+' + str(extra) + 's ' if extra else ''}{text}")
        return 0

    chunks_dir = OUT / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    report_path = OUT / "passages.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    total = sum(len(p) for _, _, p in plan)
    narrator, sr, done, built, used = None, None, 0, [], set()
    for number, title, parts in plan:
        pieces = []
        for index, (mode, text, _) in enumerate(parts, 1):
            digest = hashlib.md5(f"{mode}|{MODES[mode]}|{ref_tag(MODE_REF.get(mode, DEFAULT_REF))}|{text}".encode()).hexdigest()[:6]
            path = chunks_dir / f"s{number:02d}-{index:02d}-{mode}-{digest}.wav"
            done += 1
            used.add(path.name)
            if not path.exists():
                print(f"[{done}/{total}] {number}.{index} {mode}: {text}", flush=True)
                narrator = narrator or Narrator()
                report[path.name] = {"section": number, "mode": mode, "text": text, **render_passage(narrator, mode, text, path)}
                report_path.write_text(json.dumps(report, indent=1), encoding="utf-8")
            audio, sr = sf.read(str(path), dtype="float32")
            if NATURAL:
                piece = lengthen(tighten(render_full.trim(audio, sr), sr, NATURAL_PAUSE_MAX, NATURAL_PAUSE_KEEP), sr, STRETCH[mode])
            else:
                piece = tighten(render_full.trim(audio, sr), sr)
            pieces.append(piece)
        rng = np.random.default_rng(number)
        joined = pieces[0]
        for k, piece in enumerate(pieces[1:], 1):
            extra = parts[k - 1][2]
            if NATURAL:
                seconds = GAP_AFTER[parts[k - 1][0]] + (PIVOT_BEAT if parts[k][0] == "pivot" else 0.0) + rng.uniform(-GAP_JITTER, GAP_JITTER)
            else:
                seconds = SENTENCE_GAP
            joined = np.concatenate([joined, np.zeros(int((seconds + extra) * sr), dtype=np.float32), piece])
        built.append((number, title, joined))

    section_gap = np.zeros(int((NATURAL_SECTION_GAP if NATURAL else SECTION_GAP) * sr), dtype=np.float32)
    full, timings, cursor = [], [], 0
    for i, (number, title, audio) in enumerate(built):
        timings.append({"section": number, "title": title, "start": round(cursor / sr, 2), "end": round((cursor + len(audio)) / sr, 2)})
        full.append(audio)
        cursor += len(audio)
        if i < len(built) - 1:
            full.append(section_gap)
            cursor += len(section_gap)
    joined_all = np.concatenate(full)
    if NATURAL:
        speech_rms = float(np.sqrt(np.mean(joined_all[np.abs(joined_all) > 1e-4] ** 2)))
        joined_all = joined_all + room_tone(len(joined_all), speech_rms * 10 ** (ROOM_TONE_DB / 20))
    mastered = master(joined_all, sr)

    out_name = OUT.name if not args.sections else "test-sections-" + "-".join(str(s) for s in args.sections)
    if NATURAL:
        out_name += "-natural"
    scenes_dir = OUT / ("scenes-natural" if NATURAL else "scenes")
    scenes_dir.mkdir(exist_ok=True)
    for t in timings:
        a, b = int(t["start"] * sr), int(t["end"] * sr)
        sf.write(str(scenes_dir / f"section-{t['section']:02d}.wav"), mastered[a:b], sr, subtype="PCM_16")
    sf.write(str(OUT / f"{out_name}.wav"), mastered, sr, subtype="PCM_16")
    (OUT / f"{out_name}-timings.json").write_text(json.dumps(timings, indent=1), encoding="utf-8")

    words = sum(len(text.split()) for _, _, p in plan for _, text, _ in p)
    seconds = len(mastered) / sr
    flagged = [v for k, v in report.items() if k in used and not v["in_range"]]
    print(f"DONE {OUT / out_name}.wav: {seconds:.1f}s ({seconds / 60:.2f} min), {60 * words / seconds:.0f} words/min overall, flagged {len(flagged)}", flush=True)
    for v in flagged:
        print(f"FLAGGED {v['section']} {v['mode']} {v['words_per_second']} w/s: {v['text']}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
