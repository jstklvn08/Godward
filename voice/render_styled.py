"""Render a script in the "video essay" delivery measured from the voice demo.

    .venv\\Scripts\\python.exe render_styled.py --scenes 10    # one section, to test
    .venv\\Scripts\\python.exe render_styled.py                # every section
    .venv\\Scripts\\python.exe render_styled.py --voice bm_daniel --scenes 9 10   # another voice
    .venv\\Scripts\\python.exe render_styled.py --ref-dir reference\\own-voice    # the narrator's own voice

Each sentence gets a mode with its own Chatterbox setting:
  grave   low and slow, for the heaviest lines
  talk    quicker and conversational, for commentary
  story   brighter and livelier, for telling the story
  pivot   short turning-point lines such as "But God wasn't finished."
Then the edit follows the demo: breaths and long pauses inside a sentence are cut down,
sentences are joined with almost no gap, and only section breaks get a real pause.
The finished file is darkened slightly, set to -14 LUFS and peak-limited at -1 dBFS.

The voice is Chatterbox using a slowed clip of one of Kokoro's synthetic voices as its
reference ("am_michael" unless --voice says otherwise). Each voice renders into its own folder.
Finished passages are kept, so an interrupted run resumes where it stopped.
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

sys.path.insert(0, str(VOICE_DIR / "voice-demo-analysis" / "pylib"))
import parselmouth  # noqa: E402
import pyloudnorm  # noqa: E402
from parselmouth.praat import call  # noqa: E402

SCRIPT = VOICE_DIR.parent / "scripts" / "creation-and-the-fall-genesis-1-3-script.md"
OUT = VOICE_DIR / "full" / "genesis-1-3-essay-style"
# Chatterbox copies the reference's pace, and Kokoro's voices speak fast (Michael gave about
# 4 words/s). So the reference is slowed with librosa time_stretch, pitch unchanged: for
# Michael, 80% gave 3.1 words/s and 70% gave 2.7 words/s on the same sentence.
REFS = VOICE_DIR / "voice-tests" / "section-10" / "references"
VOICE = "am_michael"
MODE_REF: dict[str, Path] = {}
DEFAULT_REF = Path()


def use_voice(voice: str) -> None:
    """Point the renderer at a Kokoro voice, making its slowed references if needed."""
    global VOICE, OUT, DEFAULT_REF
    VOICE = voice
    OUT = VOICE_DIR / "full" / ("genesis-1-3-essay-style" if voice == "am_michael" else f"genesis-1-3-essay-style-{voice}")
    source = REFS / f"{voice}.wav"
    for rate in (80, 70):
        target = REFS / f"{voice}-slow{rate}.wav"
        if not target.exists():
            import librosa

            audio, sr = sf.read(str(source), dtype="float32")
            slow = librosa.effects.time_stretch(audio, rate=rate / 100)
            sf.write(str(target), slow / np.abs(slow).max() * 0.9, sr, subtype="PCM_16")
    MODE_REF.clear()
    MODE_REF["grave"] = REFS / f"{voice}-slow70.wav"
    DEFAULT_REF = REFS / f"{voice}-slow80.wav"


# With the narrator's own clips the reference already has a natural pace and the right
# delivery for each mode, so standard Chatterbox settings are used and pitch is not shaped.
OWN_MODES = {
    "grave": VoiceSetting(0.40, 0.40, 0.7),
    "talk": VoiceSetting(0.50, 0.50, 0.8),
    "story": VoiceSetting(0.50, 0.50, 0.8),
    "pivot": VoiceSetting(0.60, 0.50, 0.8),
}
SHAPE = True


def use_ref_dir(ref_dir: Path, name: str) -> None:
    """Use one clip per mode from ref_dir (grave.wav, talk.wav, story.wav, optional pivot.wav)."""
    global OUT, DEFAULT_REF, SHAPE
    OUT = VOICE_DIR / "full" / name
    MODE_REF.clear()
    for mode in MODES:
        if (ref_dir / f"{mode}.wav").exists():
            MODE_REF[mode] = ref_dir / f"{mode}.wav"
    DEFAULT_REF = ref_dir / "story.wav"
    MODES.update(OWN_MODES)
    SHAPE = False

# The Michael reference is a fast speaker and Chatterbox copies its pace, so CFG is kept low
# (Chatterbox's advice for fast references). Higher settings came out at 3.8-4.9 words/s.
MODES = {
    "grave": VoiceSetting(0.30, 0.25, 0.7),
    "talk": VoiceSetting(0.40, 0.45, 0.8),  # 0.30 came out slow (2.0-2.4 words/s) with the slowed reference
    "story": VoiceSetting(0.45, 0.30, 0.8),
    "pivot": VoiceSetting(0.60, 0.40, 0.8),
}
# Words per second accepted for each mode, measured after trimming the ends.
PACE = {"grave": (1.9, 2.9), "talk": (2.7, 3.9), "story": (2.4, 3.6), "pivot": (2.0, 4.2)}
SEEDS = (1, 2, 3)

# Section default mode, then sentence overrides matched on how the sentence starts.
SECTION_MODE = {1: "grave", 10: "grave"}
OVERRIDES = {
    "Then God spoke": "pivot",
    "But God wasn't finished": "pivot",
    "The climax of creation": "talk",
    "On the seventh day": "grave",
    "Genesis then moves in closer": "talk",
    "If he ate from that tree": "grave",
    "Then God said something new": "pivot",
    "It is not good for the man": "grave",
    "And the serpent contradicted": "pivot",
    "You will not certainly die": "grave",
    "But all they discovered": "grave",
    "Where are you": "grave",
    "And then came the blame": "pivot",
    "He pointed to the woman": "talk",
    "She pointed to the serpent": "talk",
    "Christians have long read": "talk",
    "Then he banished them": "grave",
    "On the east side": "grave",
}

# Chatterbox keeps every mode at about the same pitch (116-121 Hz measured), but the demo
# drops for grave lines and lifts for storytelling. So each passage is moved to its mode's
# pitch with Praat (PSOLA, formants kept), and the range is widened for livelier modes.
# (target median Hz, range factor). Demo: grave 97-118 Hz, story 142-159 Hz, overall 123 Hz.
PITCH = {"grave": (108, 1.0), "talk": (122, 1.15), "story": (145, 1.3), "pivot": (150, 1.3)}

MERGE_CHARS = 60  # Only very short sentences in the same mode are joined.
INNER_PAUSE_MAX = 0.12  # Pauses inside a passage longer than this ...
INNER_PAUSE_KEEP = 0.07  # ... are cut down to this.
SENTENCE_GAP = 0.08
SECTION_GAP = 0.5
TARGET_LUFS = -14.0
PEAK = 10 ** (-1.0 / 20)


def mode_of(section: int, sentence: str) -> str:
    for start, mode in OVERRIDES.items():
        if sentence.startswith(start):
            return mode
    return SECTION_MODE.get(section, "story")


def passages(section: int, text: str) -> list[tuple[str, str]]:
    sentences = re.split(r"(?<=[.?!])\s+", render_full.to_speech(text))
    out: list[tuple[str, str]] = []
    for sentence in sentences:
        mode = mode_of(section, sentence)
        for piece in render_full.split_long(sentence):
            if out and out[-1][0] == mode and len(out[-1][1]) + len(piece) + 1 <= MERGE_CHARS:
                out[-1] = (mode, f"{out[-1][1]} {piece}")
            else:
                out.append((mode, piece))
    return out


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
                cut_from = (i + keep // 2) * frame
                cut_to = (j - keep // 2) * frame
                pieces.append(audio[start:cut_from])
                start = cut_to
            i = j
        else:
            i += 1
    pieces.append(audio[start:])
    return np.concatenate(pieces)


def ref_tag(ref: Path) -> str:
    # Kokoro references keep their old tag so their finished passages are still reused.
    return ref.name if ref.parent == REFS else f"{ref.parent.name}/{ref.name}"


def shape_pitch(audio: np.ndarray, sr: int, mode: str) -> np.ndarray:
    """Move a passage to its mode's pitch, keeping formants and timing."""
    target, spread = PITCH[mode]
    sound = parselmouth.Sound(audio.astype(np.float64), sampling_frequency=sr)
    shifted = call(sound, "Change gender", 60, 400, 1.0, target, spread, 1.0)
    return shifted.values[0].astype(np.float32)


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
    # Darker and closer, like the demo: less top end, a little more low end.
    for freq, gain, high in ((4000, -4.0, True), (150, 2.0, False)):
        b, a = biquad_shelf(sr, freq, gain, high)
        audio = lfilter(b, a, audio).astype(np.float32)
    loudness = pyloudnorm.Meter(sr).integrated_loudness(audio)
    audio = audio * 10 ** ((TARGET_LUFS - loudness) / 20)
    # Smooth peak limiter at -1 dBFS.
    window = max(1, int(0.005 * sr))
    env = maximum_filter1d(np.abs(audio), size=window)
    gain = np.minimum(1.0, PEAK / np.maximum(env, 1e-9))
    gain = uniform_filter1d(minimum_filter1d(gain, size=window * 4), size=window * 4)
    return np.clip(audio * gain, -PEAK, PEAK).astype(np.float32)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenes", type=int, nargs="*", default=[])
    parser.add_argument("--voice", default="am_michael", help="Kokoro voice id with a clip in voice-tests/section-10/references.")
    parser.add_argument("--ref-dir", type=Path, help="Folder with the narrator's own grave/talk/story clips. Overrides --voice.")
    parser.add_argument("--name", default="genesis-1-3-own-voice", help="Output folder name under full/ when --ref-dir is used.")
    args = parser.parse_args()

    if args.ref_dir:
        use_ref_dir(args.ref_dir.resolve(), args.name)
    else:
        use_voice(args.voice)
    render_full.SCRIPT = SCRIPT
    scenes = render_full.read_scenes(set(args.scenes))
    chunks_dir = OUT / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    report_path = OUT / "passages.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}

    plan = [(n, title, passages(n, text)) for n, title, text in scenes]
    total = sum(len(p) for _, _, p in plan)
    narrator, sr, done, built, used = None, None, 0, [], set()
    for number, title, parts in plan:
        pieces = []
        for index, (mode, text) in enumerate(parts, 1):
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
            piece = tighten(render_full.trim(audio, sr), sr)
            pieces.append(shape_pitch(piece, sr, mode) if SHAPE else piece)
        gap = np.zeros(int(SENTENCE_GAP * sr), dtype=np.float32)
        joined = pieces[0]
        for piece in pieces[1:]:
            joined = np.concatenate([joined, gap, piece])
        built.append((number, title, joined))

    section_gap = np.zeros(int(SECTION_GAP * sr), dtype=np.float32)
    full, timings, cursor = [], [], 0
    for i, (number, title, audio) in enumerate(built):
        timings.append({"section": number, "title": title, "start": round(cursor / sr, 2), "end": round((cursor + len(audio)) / sr, 2)})
        full.append(audio)
        cursor += len(audio)
        if i < len(built) - 1:
            full.append(section_gap)
            cursor += len(section_gap)
    mastered = master(np.concatenate(full), sr)

    name = OUT.name if not args.scenes else "test-sections-" + "-".join(str(s) for s in args.scenes)
    scenes_dir = OUT / "scenes"
    scenes_dir.mkdir(exist_ok=True)
    for t in timings:
        a, b = int(t["start"] * sr), int(t["end"] * sr)
        sf.write(str(scenes_dir / f"section-{t['section']:02d}.wav"), mastered[a:b], sr, subtype="PCM_16")
    sf.write(str(OUT / f"{name}.wav"), mastered, sr, subtype="PCM_16")
    (OUT / f"{name}-timings.json").write_text(json.dumps(timings, indent=1), encoding="utf-8")

    words = sum(len(text.split()) for _, _, p in plan for _, text in p)
    seconds = len(mastered) / sr
    flagged = [v for k, v in report.items() if k in used and not v["in_range"]]
    print(f"DONE {name}: {seconds:.1f}s ({seconds / 60:.2f} min), {60 * words / seconds:.0f} words/min overall, flagged {len(flagged)}", flush=True)
    for v in flagged:
        print(f"FLAGGED {v['section']} {v['mode']} {v['words_per_second']} w/s: {v['text']}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
