"""Generate one narration WAV with Chatterbox.

Run with the venv in this folder:

    .venv\\Scripts\\python.exe generate.py --text "In the beginning..." --preset calm --output out\\line.wav

Use --preset for a named voice setting, or override it with --exaggeration and --cfg.
With no --voice-ref, Chatterbox's built-in default voice is used. Only pass a recording
you have the right to use. Do not clone real people's voices from the internet.
"""

from __future__ import annotations

import argparse
import gc
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

VOICE_DIR = Path(__file__).resolve().parent
# Keep the downloaded models inside voice/ instead of the user profile.
os.environ.setdefault("HF_HOME", str(VOICE_DIR / ".cache" / "huggingface"))

import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from chatterbox.tts import ChatterboxTTS  # noqa: E402


@dataclass(frozen=True)
class VoiceSetting:
    exaggeration: float
    cfg_weight: float
    temperature: float = 0.8


PRESETS = {
    "default": VoiceSetting(0.5, 0.5),
    "brisk": VoiceSetting(0.55, 0.55),
    "warm": VoiceSetting(0.65, 0.4),
    "calm": VoiceSetting(0.35, 0.45),
}


class Narrator:
    """Loads Chatterbox once and falls back to CPU if the GPU runs out of memory."""

    def __init__(self, device: str = "auto"):
        self.fallback_allowed = device == "auto"
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device
        self.model = None
        self._load()

    def _load(self) -> None:
        try:
            self.model = ChatterboxTTS.from_pretrained(device=self.device)
        except RuntimeError as err:
            if not self._switch_to_cpu(err):
                raise
            self.model = ChatterboxTTS.from_pretrained(device=self.device)

    def _switch_to_cpu(self, err: Exception) -> bool:
        if not (self.fallback_allowed and self.device == "cuda" and "out of memory" in str(err).lower()):
            return False
        print("GPU out of memory, switching to CPU.", flush=True)
        self.device = "cpu"
        self.model = None
        gc.collect()
        torch.cuda.empty_cache()
        return True

    def synthesize(self, text: str, setting: VoiceSetting, output: Path, seed: int = 1, voice_ref: Path | None = None) -> dict:
        """Write a WAV and return its generation stats."""
        started = time.perf_counter()
        try:
            wav = self._generate(text, setting, seed, voice_ref)
        except RuntimeError as err:
            if not self._switch_to_cpu(err):
                raise
            self._load()
            wav = self._generate(text, setting, seed, voice_ref)
        elapsed = time.perf_counter() - started

        audio = wav.squeeze(0).detach().cpu().numpy()
        output.parent.mkdir(parents=True, exist_ok=True)
        # torchaudio 2.9 needs torchcodec to save, so write with soundfile instead.
        sf.write(str(output), audio, self.model.sr, subtype="PCM_16")
        seconds = len(audio) / self.model.sr
        return {
            "output": str(output),
            "device": self.device,
            "seed": seed,
            "audio_seconds": round(seconds, 3),
            "generation_seconds": round(elapsed, 2),
            "realtime_factor": round(elapsed / seconds, 2),
        }

    def _generate(self, text: str, setting: VoiceSetting, seed: int, voice_ref: Path | None):
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
        return self.model.generate(
            text,
            audio_prompt_path=str(voice_ref) if voice_ref else None,
            exaggeration=setting.exaggeration,
            cfg_weight=setting.cfg_weight,
            temperature=setting.temperature,
        )


def resolve_setting(preset: str, exaggeration: float | None, cfg: float | None, temperature: float | None) -> VoiceSetting:
    base = PRESETS[preset]
    return VoiceSetting(
        exaggeration=base.exaggeration if exaggeration is None else exaggeration,
        cfg_weight=base.cfg_weight if cfg is None else cfg,
        temperature=base.temperature if temperature is None else temperature,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a narration WAV with Chatterbox.")
    text = parser.add_mutually_exclusive_group(required=True)
    text.add_argument("--text")
    text.add_argument("--text-file", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preset", choices=sorted(PRESETS), default="default")
    parser.add_argument("--exaggeration", type=float, help="Overrides the preset. Chatterbox's default is 0.5.")
    parser.add_argument("--cfg", type=float, help="Overrides the preset. Lower is slower. Chatterbox's default is 0.5.")
    parser.add_argument("--temperature", type=float, help="Overrides the preset. Chatterbox's default is 0.8.")
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--device", choices=["auto", "cuda", "cpu"], default="auto")
    parser.add_argument("--voice-ref", type=Path, help="A recording you have the right to use. Omit for the default voice.")
    args = parser.parse_args()

    spoken = args.text if args.text is not None else args.text_file.read_text(encoding="utf-8").strip()
    setting = resolve_setting(args.preset, args.exaggeration, args.cfg, args.temperature)
    stats = Narrator(args.device).synthesize(spoken, setting, args.output, args.seed, args.voice_ref)
    print(stats)
    return 0


if __name__ == "__main__":
    sys.exit(main())
