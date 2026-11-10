"""Cut one Chatterbox reference clip per delivery mode from the narrator's own recording.

    python make_own_refs.py

The recording (voice-demo.mp3) is the channel narrator's own voice. Its 8.3 s of leading
silence is skipped. Cut points are word boundaries from a whisper transcript, so each clip
starts and ends between words. Chatterbox copies the delivery of its reference, so each
mode gets the part of the recording that already sounds that way:

  grave  8.40-18.24 s  the opening hook, low and slow ("Mental health has become ... trauma,")
  talk  24.58-30.96 s  a quick conversational line ("We all know there's a big difference ...")
  story 50.58-61.96 s  livelier world-building ("Sui Ishida's Tokyo Ghoul takes place ...")
Pivot lines reuse the story clip.
"""

from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "voice-demo.mp3"
OUT = HERE / "own-voice"
CUTS = {"grave": (8.40, 18.24), "talk": (24.58, 30.96), "story": (50.58, 61.96)}
FADE = 0.02

audio, sr = librosa.load(str(SOURCE), sr=None, mono=True)
OUT.mkdir(exist_ok=True)
for mode, (start, end) in CUTS.items():
    clip = audio[int(start * sr): int(end * sr)].copy()
    ramp = np.linspace(0, 1, int(FADE * sr))
    clip[: len(ramp)] *= ramp
    clip[-len(ramp):] *= ramp[::-1]
    clip = clip / np.abs(clip).max() * 0.9
    sf.write(str(OUT / f"{mode}.wav"), clip, sr, subtype="PCM_16")
    print(f"{mode}: {len(clip) / sr:.2f}s")
