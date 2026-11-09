"""Render the clip narrations from narration.md and the settings comparison.

Writes clips/<clip>.wav, comparison/<setting>.wav and render-log.json. A clip is
re-rendered with the next seed if it runs longer than MAX_SECONDS.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from generate import PRESETS, VOICE_DIR, Narrator, VoiceSetting

MAX_SECONDS = 10.0
SEEDS = range(1, 9)
COMPARISON_SEED = 1
COMPARISON_CLIP = "3-flat-vector"
COMPARISON = {
    "a-default-ex0.5-cfg0.5": VoiceSetting(0.5, 0.5),
    "b-restrained-ex0.3-cfg0.5": VoiceSetting(0.3, 0.5),
    "c-measured-ex0.4-cfg0.3": VoiceSetting(0.4, 0.3),
    "d-dramatic-ex0.7-cfg0.3": VoiceSetting(0.7, 0.3),
}

BLOCK = re.compile(r"^## (?P<clip>\S+)\s+Preset: `(?P<preset>\w+)`.*?^> (?P<text>.+?)$", re.M | re.S)


def read_clips() -> dict[str, tuple[str, str]]:
    source = (VOICE_DIR / "narration.md").read_text(encoding="utf-8")
    return {m["clip"]: (m["preset"], m["text"].strip()) for m in BLOCK.finditer(source)}


def main() -> int:
    only = set(sys.argv[1:])
    clips = read_clips()
    narrator = Narrator()
    print(f"device: {narrator.device}", flush=True)
    log_path = VOICE_DIR / "render-log.json"
    log = json.loads(log_path.read_text(encoding="utf-8")) if log_path.exists() else {}

    for clip, (preset, text) in clips.items():
        if only and clip not in only:
            continue
        output = VOICE_DIR / "clips" / f"{clip}.wav"
        attempts = []
        for seed in SEEDS:
            stats = narrator.synthesize(text, PRESETS[preset], output, seed)
            attempts.append(stats)
            print(clip, stats, flush=True)
            if stats["audio_seconds"] <= MAX_SECONDS:
                break
        log[clip] = {"preset": preset, "text": text, "attempts": attempts}
        log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")

    if not only or "comparison" in only:
        text = clips[COMPARISON_CLIP][1]
        for name, setting in COMPARISON.items():
            stats = narrator.synthesize(text, setting, VOICE_DIR / "comparison" / f"{name}.wav", COMPARISON_SEED)
            print(name, stats, flush=True)
            log[f"comparison/{name}"] = {"text": text, "setting": vars(setting), "attempts": [stats]}
        log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
