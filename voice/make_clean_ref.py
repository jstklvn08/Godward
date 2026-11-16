"""Clean a voice recording into a Chatterbox reference clip.

    .venv\\Scripts\\python.exe make_clean_ref.py <input.wav> <output.wav> [--start S --end S]

Keeps only the spoken part (trimmed between words when --start/--end are given,
otherwise at the first and last loud frame), removes rumble and hiss, softens
harsh distortion peaks, and levels it. Only use a recording of your own voice,
or one you have permission to use.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import librosa
import numpy as np
import pyloudnorm
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

TARGET_LUFS = -20.0
PEAK = 10 ** (-1.0 / 20)
FADE = 0.02


def trim_to_speech(audio: np.ndarray, sr: int, start: float | None, end: float | None) -> np.ndarray:
    if start is not None or end is not None:
        a = int((start or 0) * sr)
        b = int(end * sr) if end is not None else len(audio)
        return audio[a:b]
    intervals = librosa.effects.split(audio, top_db=35, frame_length=1024, hop_length=256)
    if not len(intervals):
        return audio
    pad = int(0.05 * sr)
    return audio[max(0, intervals[0][0] - pad): min(len(audio), intervals[-1][1] + pad)]


def band_limit(audio: np.ndarray, sr: int) -> np.ndarray:
    # Rumble below 70 Hz and fizz above 10 kHz carry no voice, only noise and artefacts.
    sos = butter(4, [70, min(10000, sr / 2 * 0.95)], btype="bandpass", fs=sr, output="sos")
    return sosfiltfilt(sos, audio)


def spectral_gate(audio: np.ndarray, sr: int, reduce_db: float = 12.0) -> np.ndarray:
    """Lower steady background noise, estimated from the quietest 10% of frames."""
    n_fft, hop = 1024, 256
    spec = librosa.stft(audio, n_fft=n_fft, hop_length=hop)
    mag, phase = np.abs(spec), np.angle(spec)
    energy = mag.sum(axis=0)
    quiet = mag[:, energy <= np.percentile(energy, 10)]
    noise = np.median(quiet, axis=1, keepdims=True) if quiet.size else np.zeros((mag.shape[0], 1))
    floor = 10 ** (-reduce_db / 20)
    gain = np.clip((mag - 1.5 * noise) / np.maximum(mag, 1e-9), floor, 1.0)
    # Smooth the gain over time so the gating doesn't add its own warble.
    gain = librosa.decompose.nn_filter(gain, aggregate=np.median, metric="cosine", width=3) if gain.shape[1] > 6 else gain
    return librosa.istft(mag * gain * np.exp(1j * phase), hop_length=hop, length=len(audio))


def soften_peaks(audio: np.ndarray, threshold: float = 0.5) -> np.ndarray:
    """Round off the sharp peaks that read as crackle or clipping."""
    peak = np.abs(audio).max() or 1.0
    x = audio / peak
    over = np.abs(x) > threshold
    x[over] = np.sign(x[over]) * (threshold + (1 - threshold) * np.tanh((np.abs(x[over]) - threshold) / (1 - threshold)))
    return x * peak


def level(audio: np.ndarray, sr: int) -> np.ndarray:
    loudness = pyloudnorm.Meter(sr).integrated_loudness(audio)
    audio = pyloudnorm.normalize.loudness(audio, loudness, TARGET_LUFS)
    peak = np.abs(audio).max()
    return audio * (PEAK / peak) if peak > PEAK else audio


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--start", type=float, help="Start of the spoken part, in seconds.")
    parser.add_argument("--end", type=float, help="End of the spoken part, in seconds.")
    args = parser.parse_args()

    audio, sr = librosa.load(str(args.input), sr=None, mono=True)
    audio = trim_to_speech(audio, sr, args.start, args.end)
    audio = band_limit(audio, sr)
    audio = spectral_gate(audio, sr)
    audio = soften_peaks(audio)
    audio = level(audio, sr)
    ramp = np.linspace(0, 1, int(FADE * sr))
    audio[: len(ramp)] *= ramp
    audio[-len(ramp):] *= ramp[::-1]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(args.output), audio.astype(np.float32), sr, subtype="PCM_16")
    print(f"{args.output}: {len(audio) / sr:.2f} s at {sr} Hz")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
