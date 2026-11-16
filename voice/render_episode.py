"""Render a full episode script in the narrator's own voice.

    .venv\\Scripts\\python.exe render_episode.py                      # scripts/01-creation-and-the-fall.md
    .venv\\Scripts\\python.exe render_episode.py --sections 0 1       # just some sections, to test
    .venv\\Scripts\\python.exe render_episode.py --device cuda        # GPU (default is CPU)

Reads the "> " lines under each section's **Narration:** heading. A line like
`{{ESV Genesis 1:2}} (read up to "the face of the deep")` is fetched from the ESV API
(set ESV_API_KEY first) and trimmed by the TRIM rules below, never typed from memory.
The fetched text is cached in full/<name>/scripture.esv.json, which git ignores.
Without a key or cache, scripture lines are skipped and the output is marked DRAFT.

The voice is Chatterbox with one reference clip per delivery mode, cut from the
narrator's own CapCut voice-over (reference/capcut-vo, made by make_vo_refs.py). Every mode
uses the settings the narrator approved in the render_vo_sample.py tests (exaggeration 0.5,
cfg 0.3, temperature 0.8, best of three takes). Chatterbox lands about 2.5 semitones above
the narrator with a narrower range, so the mix is moved to the narrator's median pitch with
Praat PSOLA (formants kept) before mastering. Never time-stretch: it made the clone robotic.
  grave  scripture, and the heaviest lines
  talk   commentary
  story  telling the story (the default)
  pivot  short turning-point lines (uses the story clip, a little more energy)
Then the edit follows the demo: long pauses inside a passage are cut down, passages are
nearly butted together inside a script line and get varied short gaps between lines,
sections get a longer pause. The mix is resampled to 44.1 kHz, room noise in pauses is
gated to silence, and it is set to -14 LUFS with a -1 dBFS peak limit. Finished passages are cached, so an interrupted run resumes and re-assembling
after a change to the edit costs no new generation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from math import gcd
from pathlib import Path

import numpy as np
import parselmouth
import soundfile as sf
import pyloudnorm
import torch
from parselmouth.praat import call
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import lfilter, resample_poly

import render_full
from generate import VOICE_DIR, Narrator, VoiceSetting

ROOT = VOICE_DIR.parent
sys.path.insert(0, str(ROOT / "scripts"))
import fill_esv  # noqa: E402

SCRIPT = ROOT / "scripts" / "01-creation-and-the-fall.md"
REF_DIR = VOICE_DIR / "reference" / "capcut-vo"

# The approved "natural" setting for every mode; the reference clip carries the delivery.
MODES = {mode: VoiceSetting(0.50, 0.30, 0.8) for mode in ("grave", "talk", "story", "pivot")}
MODE_REF = {"grave": "grave.wav", "talk": "talk.wav", "story": "story.wav", "pivot": "story.wav"}
# Words per second accepted for each mode, measured after trimming the ends.
PACE = {"grave": (1.9, 2.9), "talk": (2.7, 3.9), "story": (2.4, 3.6), "pivot": (2.0, 4.2)}
SEEDS = (1, 2, 3)

# Section default mode, then sentence overrides matched on how the sentence starts.
SECTION_MODE = {0: "grave"}
OVERRIDES = {
    "How did it come to this": "pivot",
    "To find out": "talk",
    "All the way back": "pivot",
    "It's one of the most famous": "talk",
    "And notice what it doesn't": "talk",
    "It doesn't argue": "talk",
    "It starts with him": "talk",
    "Then the story drops in": "pivot",
    "No shape": "grave",
    "No light": "grave",
    "Just water and dark": "grave",
    "Then God speaks": "pivot",
    "Light comes first": "talk",
    "Light here doesn't": "talk",
    "It comes from a word": "grave",
    "Then the rhythm breaks": "pivot",
    "He says: let us make man": "grave",
    "Not just good": "pivot",
    "On the seventh day": "grave",
    "Chapter two zooms in": "talk",
    "It tells the same story": "talk",
    "Now God is called": "talk",
    "So where was Eden": "pivot",
    "Honestly, nobody knows": "talk",
    "The other two rivers": "talk",
    "The map can point": "talk",
    "It can't put a pin": "talk",
    "And here God gives": "talk",
    "One limit": "talk",
    "Hold on to that": "talk",
    "It's about to be argued": "pivot",
    "For the first time in the story": "grave",
    "Then a new character": "pivot",
    "Genesis doesn't say where": "talk",
    "Later writers": "talk",
    "And it opens not with a lie": "talk",
    "Did God really say": "talk",
    "It takes God's one": "talk",
    "Put the two sentences": "talk",
    "God said you must not": "talk",
    "The serpent says": "talk",
    "Same little word": "pivot",
    "The real temptation": "grave",
    "It's the idea that God": "grave",
    "Not an apple": "talk",
    "Genesis never says": "talk",
    "What matters is what it costs": "grave",
    "What they knew first was shame": "grave",
    "Then comes the first question": "pivot",
    "Not because God doesn't know": "talk",
    "It's an invitation": "talk",
    "Instead, the blame starts": "pivot",
    "And at the end of it": "grave",
    "But tucked inside": "pivot",
    "Christians have long read": "talk",
    "Judgement, but also care": "grave",
    "So the Lord God sends them": "grave",
    "So that's the answer": "talk",
    "Paradise is guarded": "grave",
    "But notice what's being guarded": "pivot",
    "The way is closed": "grave",
    "It hasn't disappeared": "grave",
    "And the rest of the Bible": "story",
}

# How to cut a whole verse down to the part each scene note asks for.
TRIM = {
    "Genesis 1:2": ("upto", "the face of the deep"),
    "Genesis 2:18": ("quote_clause",),
    "Genesis 2:23": ("quote_clause",),
    "Genesis 3:1": ("first_sentence",),
    "Genesis 3:6": ("from", "she took of its fruit"),
    "Genesis 3:9": ("quote",),
    "Genesis 3:12": ("quote",),
    "Genesis 3:13": ("last_quote",),
    "Genesis 3:19": ("after_last", ";"),
}

MERGE_CHARS = 60
INNER_PAUSE_MAX = 0.12
INNER_PAUSE_KEEP = 0.07
# The demo runs sentences together (4 of 5 sentence joins were 0.12 s or less, at irregular
# lengths) and only stops properly at a change of topic. So passages inside one script line
# are nearly butted together, and joins between lines get a varied short gap.
PASSAGE_GAP = 0.03
LINE_GAP = (0.02, 0.11)  # picked per join from the next passage's length, so re-runs match
SCRIPTURE_GAP = 0.3  # around scripture readings, so they stand apart
PAUSE_MARK = 1.0  # a "[pause]" line in the script
SECTION_GAP = 0.6
TARGET_LUFS = -14.0
PEAK = 10 ** (-1.0 / 20)
OUT_SR = 44100  # the demo's delivery rate; Chatterbox makes 24 kHz
# The demo's pauses are digital silence; the own-voice chunks carry room noise at about
# -53 dBFS. Frames this far below the speech level are gated to silence. (Breaths need no
# extra step: tighten() already cuts them out of the pauses inside a passage.)
GATE_BELOW = 42.0  # dB under the speech level: silence below this
GATE_RANGE = 8.0  # dB over which the gate fades in above that
# Measured on VO .MP3: median 107 Hz, 14.2 semitone range (10th-90th percentile).
PITCH_MEDIAN = 107.0
PITCH_RANGE_FACTOR = 1.25
# No tone shaping: the clone is already a little darker than the narrator, and the approved
# test had none. (The old own-voice mix cut 4 kHz by 4 dB and lifted 150 Hz by 2 dB.)
EQ: tuple[tuple[float, float, bool], ...] = ()

PLACEHOLDER = re.compile(r"^\{\{ESV ([^}]+)\}\}\s*(?:\((.+)\))?\s*$")


def read_sections(script: Path) -> list[tuple[int, str, list[str]]]:
    """Each section's number, title and narration lines, in order."""
    sections, current, in_narration = [], None, False
    for line in script.read_text(encoding="utf-8").splitlines():
        head = re.match(r"^## (\d+)\. (.+?)(?: \([\d:–-]+\))?$", line)
        if head:
            current = (int(head[1]), head[2].strip(), [])
            sections.append(current)
            in_narration = False
        elif line.startswith("**Narration:**"):
            in_narration = current is not None and "none" not in line.lower()
        elif line.startswith("**") or line.startswith("---"):
            in_narration = False
        elif in_narration and line.startswith("> "):
            current[2].append(line[2:].strip())
    return [s for s in sections if s[2]]


def _quotes(text: str) -> list[str]:
    return re.findall(r"“(.+?)”(?=\s|$|[A-Z])", text) or re.findall(r"“(.+?)”", text)


def trim_verse(ref: str, text: str) -> str:
    rule = TRIM.get(ref)
    if rule is None:
        out = text
    elif rule[0] == "upto":
        i = text.find(rule[1])
        out = text[: i + len(rule[1])] if i >= 0 else None
    elif rule[0] == "from":
        i = text.find(rule[1])
        out = text[i:] if i >= 0 else None
    elif rule[0] == "first_sentence":
        out = re.split(r"(?<=[.?!])\s", text, maxsplit=1)[0]
    elif rule[0] in ("quote", "quote_clause", "last_quote"):
        quotes = _quotes(text)
        out = (quotes[-1] if rule[0] == "last_quote" else quotes[0]) if quotes else None
        if out and rule[0] == "quote_clause":
            out = out.split(";")[0]
    elif rule[0] == "after_last":
        out = text.rsplit(rule[1], 1)[-1] if rule[1] in text else None
    else:
        out = None
    if not out:
        sys.exit(f"Could not trim {ref} with {rule}: {text}")
    out = out.strip().strip("“”‘’ ").strip()
    out = out[0].upper() + out[1:]
    return out if out[-1] in ".?!" else out.rstrip(",;:") + "."


def scripture(ref: str, cache_path: Path) -> str | None:
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    if ref not in cache:
        key = os.environ.get("ESV_API_KEY")
        if not key:
            return None
        cache[ref] = fill_esv.fetch(ref, key)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(cache, indent=1, ensure_ascii=False), encoding="utf-8")
    return trim_verse(ref, cache[ref])


def speakable(text: str) -> str:
    text = render_full.to_speech(text).replace("LORD", "Lord").replace("‘", "").replace("’", "'")
    return re.sub(r'"', "", text)


def mode_of(section: int, sentence: str, is_scripture: bool) -> str:
    if is_scripture:
        return "grave"
    for start, mode in OVERRIDES.items():
        if sentence.startswith(start):
            return mode
    return SECTION_MODE.get(section, "story")


def plan_section(number: int, lines: list[str], cache_path: Path, missing: list[str]) -> list[tuple]:
    """Passages as (kind, mode, text) with kind "speech", "scripture", "pause" or "line" (a script line break)."""
    out: list[tuple] = []
    for line in lines:
        if out and out[-1][0] not in ("pause", "line"):
            out.append(("line", None, None))
        if line.strip("[] ").lower() == "pause":
            out.append(("pause", None, None))
            continue
        m = PLACEHOLDER.match(line)
        if m:
            text = scripture(m[1].strip(), cache_path)
            if text is None:
                missing.append(m[1].strip())
                continue
            kind = "scripture"
        else:
            text, kind = line, "speech"
        line_start = len(out)  # Passages are only merged within one script line.
        for sentence in re.split(r"(?<=[.?!])\s+", speakable(text)):
            mode = mode_of(number, sentence, kind == "scripture")
            for piece in render_full.split_long(sentence):
                last = out[-1] if len(out) > line_start else None
                if last and last[0] == kind and last[1] == mode and len(last[2]) + len(piece) + 1 <= MERGE_CHARS:
                    out[-1] = (kind, mode, f"{last[2]} {piece}")
                else:
                    out.append((kind, mode, piece))
    return out


class OwnVoice:
    """Chatterbox with one cached reference per clip, so each clip is analysed only once."""

    def __init__(self, device: str):
        self.narrator = Narrator(device)
        self.conds = {}

    def say(self, text: str, mode: str, seed: int, out: Path) -> float:
        model = self.narrator.model
        setting = MODES[mode]
        ref = REF_DIR / MODE_REF[mode]
        if ref not in self.conds:
            model.prepare_conditionals(str(ref), exaggeration=setting.exaggeration)
            self.conds[ref] = model.conds
        model.conds = self.conds[ref]
        torch.manual_seed(seed)
        started = time.perf_counter()
        wav = model.generate(text, exaggeration=setting.exaggeration, cfg_weight=setting.cfg_weight, temperature=setting.temperature)
        sf.write(str(out), wav.squeeze(0).cpu().numpy(), model.sr, subtype="PCM_16")
        return time.perf_counter() - started


def render_passage(voice: OwnVoice, mode: str, text: str, path: Path) -> dict:
    words = len(text.split())
    low, high = PACE[mode]
    target = (low + high) / 2
    best, compute = None, 0.0
    for seed in SEEDS:
        attempt = path.with_suffix(f".seed{seed}.wav")
        compute += voice.say(text, mode, seed, attempt)
        audio, sr = sf.read(str(attempt), dtype="float32")
        wps = words / (len(render_full.trim(audio, sr)) / sr)
        print(f"  {mode} seed {seed}: {wps:.2f} words/s", flush=True)
        if best is None or abs(wps - target) < abs(best[1] - target):
            best = (attempt, wps, seed)
        if low <= wps <= high:
            break
    best[0].replace(path)
    for leftover in path.parent.glob(f"{path.stem}.seed*.wav"):
        leftover.unlink()
    audio, sr = sf.read(str(path), dtype="float32")
    return {"seed": best[2], "words_per_second": round(best[1], 2), "in_range": bool(low <= best[1] <= high),
            "compute_seconds": round(compute, 1), "audio_seconds": round(len(audio) / sr, 2)}


def tighten(audio: np.ndarray, sr: int) -> np.ndarray:
    """Cut breaths and long pauses inside a passage down to a short gap."""
    frame = int(0.01 * sr)
    count = len(audio) // frame
    rms = np.sqrt(np.mean(audio[: count * frame].reshape(count, frame) ** 2, axis=1))
    quiet = 20 * np.log10(np.maximum(rms, 1e-9)) < 20 * np.log10(np.abs(audio).max() + 1e-9) - 35
    keep = int(INNER_PAUSE_KEEP / 0.01)
    pieces, start, i = [], 0, 0
    while i < count:
        if quiet[i]:
            j = i
            while j < count and quiet[j]:
                j += 1
            if (j - i) * 0.01 > INNER_PAUSE_MAX and i > 0 and j < count:
                pieces.append(audio[start : (i + keep // 2) * frame])
                start = (j - keep // 2) * frame
            i = j
        else:
            i += 1
    pieces.append(audio[start:])
    return np.concatenate(pieces)


def join_passages(parts: list[tuple[str, np.ndarray | None]], sr: int) -> np.ndarray:
    """Join a section's passages: short gaps inside a script line, varied ones between lines."""
    joined, prev, line_break = [], None, False
    for kind, audio in parts:
        if kind == "line":
            line_break = True
            continue
        if prev is not None and kind != "pause" and prev != "pause":
            if "scripture" in (kind, prev) and kind != prev:
                gap = SCRIPTURE_GAP
            elif line_break:
                gap = np.random.default_rng(len(audio)).uniform(*LINE_GAP)
            else:
                gap = PASSAGE_GAP
            joined.append(np.zeros(int(gap * sr), dtype=np.float32))
        joined.append(audio)
        prev, line_break = kind, False
    return np.concatenate(joined)


def gate(audio: np.ndarray, sr: int) -> np.ndarray:
    """Gate the room noise in pauses to silence, like the demo."""
    hop, win = int(0.01 * sr), int(0.02 * sr)
    count = max(1, (len(audio) - win) // hop + 1)
    idx = np.arange(win)[None, :] + hop * np.arange(count)[:, None]
    db = 10 * np.log10(np.maximum(np.mean(audio[idx] ** 2, axis=1), 1e-12))
    speech = np.percentile(db[db > -70], 90) if np.any(db > -70) else -20.0
    # 0 below speech - GATE_BELOW, fading up to 1 over GATE_RANGE dB; opened a frame early
    # on each side so word onsets and tails aren't clipped, then smoothed.
    gain = np.clip((db - (speech - GATE_BELOW)) / GATE_RANGE, 0, 1)
    gain = maximum_filter1d(gain, size=3)
    gain = uniform_filter1d(gain, size=5)
    centres = np.arange(count) * hop + win // 2
    per_sample = np.interp(np.arange(len(audio)), centres, gain)
    return (audio * per_sample).astype(np.float32)


def shelf(sr: int, freq: float, gain_db: float, high: bool):
    """RBJ cookbook shelf filter, slope 1."""
    a = 10 ** (gain_db / 40)
    w = 2 * np.pi * freq / sr
    cos, sq = np.cos(w), 2 * np.sqrt(a) * np.sin(w) / 2 * np.sqrt(2)
    if high:
        b = [a * ((a + 1) + (a - 1) * cos + sq), -2 * a * ((a - 1) + (a + 1) * cos), a * ((a + 1) + (a - 1) * cos - sq)]
        d = [(a + 1) - (a - 1) * cos + sq, 2 * ((a - 1) - (a + 1) * cos), (a + 1) - (a - 1) * cos - sq]
    else:
        b = [a * ((a + 1) - (a - 1) * cos + sq), 2 * a * ((a - 1) - (a + 1) * cos), a * ((a + 1) - (a - 1) * cos - sq)]
        d = [(a + 1) + (a - 1) * cos + sq, -2 * ((a - 1) + (a + 1) * cos), (a + 1) + (a - 1) * cos - sq]
    return np.array(b) / d[0], np.array(d) / d[0]


def match_pitch(audio: np.ndarray, sr: int) -> np.ndarray:
    """Move the median pitch to the narrator's and widen the range, keeping formants (PSOLA)."""
    sound = parselmouth.Sound(audio.astype(np.float64), sr)
    moved = call(sound, "Change gender", 60, 400, 1.0, PITCH_MEDIAN, PITCH_RANGE_FACTOR, 1.0)
    return moved.values[0][: len(audio)].astype(np.float32)


def master(audio: np.ndarray, sr: int) -> np.ndarray:
    """Returns the finished mix at OUT_SR."""
    audio = match_pitch(audio, sr)
    if sr != OUT_SR:
        g = gcd(sr, OUT_SR)
        audio = resample_poly(audio, OUT_SR // g, sr // g).astype(np.float32)
        sr = OUT_SR
    for freq, gain, high in EQ:
        b, a = shelf(sr, freq, gain, high)
        audio = lfilter(b, a, audio).astype(np.float32)
    audio = gate(audio, sr)
    loudness = pyloudnorm.Meter(sr).integrated_loudness(audio)
    audio = audio * 10 ** ((TARGET_LUFS - loudness) / 20)
    window = max(1, int(0.005 * sr))
    env = maximum_filter1d(np.abs(audio), size=window)
    gain = np.minimum(1.0, PEAK / np.maximum(env, 1e-9))
    gain = uniform_filter1d(minimum_filter1d(gain, size=window * 4), size=window * 4)
    return np.clip(audio * gain, -PEAK, PEAK).astype(np.float32)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--script", type=Path, default=SCRIPT)
    parser.add_argument("--name", default="01-creation-and-the-fall-own-voice")
    parser.add_argument("--sections", type=int, nargs="*", default=[])
    parser.add_argument("--device", choices=["cpu", "cuda", "auto"], default="cpu")
    parser.add_argument("--plan-only", action="store_true", help="Print the passages and modes, render nothing.")
    args = parser.parse_args()

    out_dir = VOICE_DIR / "full" / args.name
    cache_path = out_dir / "scripture.esv.json"
    missing: list[str] = []
    sections = [s for s in read_sections(args.script.resolve()) if not args.sections or s[0] in args.sections]
    plan = [(n, title, plan_section(n, lines, cache_path, missing)) for n, title, lines in sections]
    if args.plan_only:
        for n, title, parts in plan:
            print(f"## {n}. {title}")
            for kind, mode, text in parts:
                if kind == "line":
                    continue
                print(f"  [{kind}{'/' + mode if mode else ''}] {text or ''}")
        print("missing scripture:", ", ".join(missing) or "none")
        return 0
    spoken = ("speech", "scripture")

    chunks = out_dir / "chunks"
    chunks.mkdir(parents=True, exist_ok=True)
    report_path = out_dir / "passages.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    total = sum(1 for _, _, p in plan for k, _, _ in p if k in spoken)
    voice, sr, done, used, built = None, 24000, 0, set(), []
    started = time.perf_counter()

    for number, title, parts in plan:
        audio_parts: list[tuple[str, np.ndarray]] = []
        for index, (kind, mode, text) in enumerate(parts, 1):
            if kind == "pause":
                audio_parts.append((kind, np.zeros(int(PAUSE_MARK * sr), dtype=np.float32)))
                continue
            if kind == "line":
                audio_parts.append((kind, None))
                continue
            digest = hashlib.md5(f"{mode}|{MODES[mode]}|{MODE_REF[mode]}|{text}".encode()).hexdigest()[:6]
            # Named by content, not position, so adding scripture later reuses finished passages.
            path = chunks / f"s{number:02d}-{mode}-{digest}.wav"
            done += 1
            used.add(path.name)
            if not path.exists():
                print(f"[{done}/{total}] {number}.{index} {kind}/{mode}: {text}", flush=True)
                voice = voice or OwnVoice(args.device)
                report[path.name] = {"section": number, "kind": kind, "mode": mode, "text": text,
                                     **render_passage(voice, mode, text, path)}
                report_path.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
            audio, sr = sf.read(str(path), dtype="float32")
            audio_parts.append((kind, tighten(render_full.trim(audio, sr), sr)))

        built.append((number, title, join_passages(audio_parts, sr)))

    full, timings, cursor = [], [], 0
    for i, (number, title, audio) in enumerate(built):
        timings.append({"section": number, "title": title, "start": round(cursor / sr, 2), "end": round((cursor + len(audio)) / sr, 2)})
        full.append(audio)
        cursor += len(audio)
        if i < len(built) - 1:
            full.append(np.zeros(int(SECTION_GAP * sr), dtype=np.float32))
            cursor += int(SECTION_GAP * sr)
    mastered = master(np.concatenate(full), sr)
    sr = OUT_SR

    draft = "-DRAFT-no-scripture" if missing else ""
    name = args.name + ("-sections-" + "-".join(map(str, args.sections)) if args.sections else "") + draft
    scenes = out_dir / "sections"
    scenes.mkdir(exist_ok=True)
    for t in timings:
        sf.write(str(scenes / f"section-{t['section']:02d}{draft}.wav"), mastered[int(t["start"] * sr) : int(t["end"] * sr)], sr, subtype="PCM_16")
    sf.write(str(out_dir / f"{name}.wav"), mastered, sr, subtype="PCM_16")
    (out_dir / f"{name}-timings.json").write_text(json.dumps(timings, indent=1), encoding="utf-8")

    seconds = len(mastered) / sr
    words = sum(len(t.split()) for _, _, p in plan for k, _, t in p if k in spoken)
    flagged = [v for k, v in report.items() if k in used and not v["in_range"]]
    print(f"DONE {name}.wav: {seconds:.1f}s ({seconds / 60:.2f} min), {60 * words / seconds:.0f} words/min, "
          f"wall {time.perf_counter() - started:.0f}s, flagged {len(flagged)}", flush=True)
    for v in flagged:
        print(f"FLAGGED {v['section']} {v['mode']} {v['words_per_second']} w/s: {v['text']}", flush=True)
    if missing:
        print("SKIPPED scripture (set ESV_API_KEY and re-run):", ", ".join(dict.fromkeys(missing)), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
