"""Re-speak the CapCut voice-over's own transcript with the clone made from it, for an A/B check.

Uses the reference clips from make_vo_refs.py (reference/capcut-vo) through render_episode's
Chatterbox setup, renders one take per line, stretches each line to
its length in the original, and masters to the episode loudness.

    .venv/Scripts/python.exe render_vo_sample.py
"""
from __future__ import annotations

import argparse
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

import parselmouth
import pyloudnorm
from parselmouth.praat import call

import render_episode as ep
from generate import VoiceSetting

VOICE_DIR = Path(__file__).resolve().parent
OUT_DIR = VOICE_DIR / "full" / "capcut-vo-sample"

# The original's pace is 2.77 words/s; accept a narrow band around it in every mode.
ep.REF_DIR = VOICE_DIR / "reference" / "capcut-vo"
ep.PACE = {mode: (2.55, 3.05) for mode in ep.PACE}

# A short test: three lines of the transcript, each with the length it has in VO .MP3 (seconds),
# so the clone is stretched to the original's exact pace.
PASSAGES = [
    ("story", "Between nineteen seventy-nine and nineteen ninety-five, wages for young men fell from twelve nineteen an hour to eight seventy-two.", 9.30),
    ("grave", "Down, not up.", 1.55),
    ("talk", "Gen Z didn't break the deal. They showed up twenty years late to a deal that was already broken, looked around, and declined to pretend otherwise.", 8.25),
]
GAP = 0.22  # seconds between passages; the original runs its sentences close together


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="capcut-vo-clone-sample")
    parser.add_argument("--natural", action="store_true",
                        help="No time-stretch, pause cutting, gate or EQ: just the takes at -16 LUFS.")
    parser.add_argument("--exaggeration", type=float)
    parser.add_argument("--cfg", type=float)
    parser.add_argument("--temperature", type=float)
    parser.add_argument("--seeds", type=int, default=1, help="Takes per line; the one nearest the pace band wins.")
    parser.add_argument("--pitch-median", type=float,
                        help="Move the clone's median pitch to this many Hz with Praat PSOLA (formants kept).")
    parser.add_argument("--range-factor", type=float, default=1.0, help="Widen (>1) or narrow the pitch range.")
    args = parser.parse_args()
    ep.SEEDS = tuple(range(1, args.seeds + 1))
    for mode, s in ep.MODES.items():
        ep.MODES[mode] = VoiceSetting(args.exaggeration if args.exaggeration is not None else s.exaggeration,
                                      args.cfg if args.cfg is not None else s.cfg_weight,
                                      args.temperature if args.temperature is not None else s.temperature)
    out_dir = OUT_DIR / args.name
    out_dir.mkdir(parents=True, exist_ok=True)
    voice = ep.OwnVoice("auto")
    sr = voice.narrator.model.sr
    parts = []
    for i, (mode, text, target) in enumerate(PASSAGES):
        path = out_dir / f"passage-{i:02d}.wav"
        info = ep.render_passage(voice, mode, text, path)
        print(f"[{i + 1}/{len(PASSAGES)}] {mode} {info}", flush=True)
        audio, _ = sf.read(str(path), dtype="float32")
        if not args.natural:
            audio = ep.tighten(ep.render_full.trim(audio, sr), sr)
            rate = len(audio) / sr / target
            audio = librosa.effects.time_stretch(audio, rate=rate).astype(np.float32)
            print(f"  stretched x{rate:.2f} to {target:.2f} s", flush=True)
        parts.append(audio)
        parts.append(np.zeros(int(GAP * sr), dtype=np.float32))
    joined = np.concatenate(parts[:-1])
    if args.pitch_median:
        snd = parselmouth.Sound(joined.astype(np.float64), sr)
        moved = call(snd, "Change gender", 60, 400, 1.0, args.pitch_median, args.range_factor, 1.0)
        joined = moved.values[0].astype(np.float32)
        print(f"  pitch median -> {args.pitch_median} Hz, range x{args.range_factor}", flush=True)
    if args.natural:
        meter = pyloudnorm.Meter(sr)
        mixed, out_sr = np.clip(pyloudnorm.normalize.loudness(joined, meter.integrated_loudness(joined), -16.0), -0.98, 0.98), sr
    else:
        mixed, out_sr = ep.master(joined, sr), ep.OUT_SR
    out = out_dir / f"{args.name}.wav"
    sf.write(str(out), mixed, out_sr, subtype="PCM_16")
    print(f"wrote {out} ({len(mixed) / out_sr:.1f} s)")


if __name__ == "__main__":
    main()
