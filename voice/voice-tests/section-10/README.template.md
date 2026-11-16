# Section 10 voice test: Kokoro voices and Chatterbox clones of them

**Nobody has listened to any of this audio.** Everything below comes from measurements and an automatic transcript, not from listening. A person needs to listen before any voice is chosen.

Narration, used exactly as written for every take:

> {narration}

- `kokoro/`: Kokoro-82M (package `kokoro` 0.9.4, `misaki` 0.9.4, espeak-ng 1.51), built-in voices only, speed 1.0. Each sentence was rendered separately and the sentences were joined with 0.3 s of silence.
- `references/`: about 12 s of each Kokoro voice reading a neutral, non-scripture text. The cut is made at the quietest point near 12 s, so clips run 10.8-13.0 s.
- `chatterbox-cloned/`: `chatterbox-tts` 0.1.7 with that voice's reference as `audio_prompt_path`, exaggeration 0.3, cfg_weight 0.5, seed 1 set before every sentence. Each sentence was rendered separately and the sentences were joined with 0.3 s of silence.
- Device: CPU, no GPU. Kokoro took {ktime} s for {kaud} s of audio ({krtf} s of compute per second of audio). Chatterbox took {ctime} min for {caud} s of audio ({crtf} s of compute per second of audio).

## Results

Speaking rate is the 83 script words divided by the full file length, pauses included. "Non-silent" means more than 30% of 20 ms frames are above -40 dBFS and the peak is above -26 dBFS. Median pitch comes from librosa pYIN over 60-450 Hz. The word check is a faster-whisper `small.en` transcript compared word by word with the script. A flag may be a speech-recognition error rather than a speech error, so listen to flagged takes first.

{table}

## Pitch comparison

The rule: if two voices' median pitch is within 1 semitone (about 6%) in both their Kokoro and Chatterbox takes, swap one of them.

{pitch}

Swaps made:
- **Before the Chatterbox run**, Kokoro pitch only, using a 0.5-semitone cut-off:
  - af_bella (A-, 203 Hz) was within 0.2 st of af_heart (201 Hz).
  - af_sarah (C+, 197 Hz) was within 0.3 st of af_heart.
  - am_puck (C+, 114 Hz) was within 0.1 st of am_michael (115 Hz).
  - They were replaced by af_nicole, af_kore and bm_lewis.
- **After the first full check**, using the 1-semitone rule above:
  - bf_isabella (C) was 0.69 st from af_heart in Kokoro and 0.0 st in Chatterbox (both 196.1 Hz). It was replaced by bf_alice.
  - bm_george (C) was 1.0 st from am_fenrir in Kokoro and 0.41 st in Chatterbox. It was replaced by bm_daniel.
- **After the swaps**, no pair is within 1 semitone in both versions.
  - Chatterbox narrows the spread, so some pairs are still close in the Chatterbox takes only. am_michael, bm_fable and bm_daniel are all within 0.9 st of each other, and af_heart and bf_alice are 0.3 st apart.
  - Pitch is only one dimension of how distinct a voice is. Accent and timbre are not measured here.

The swaps cost grade. Using the British replacements bf_alice and bm_daniel (both D) keeps a British voice of each gender with distinct pitch.

## Flagged takes

- **`chatterbox-cloned/04-female-bf_alice.wav`:** the last sentence was transcribed as "To no dust you all, and to dust you will return". Treat it as a probable real mispronunciation. It would need a re-render with another seed, but this test fixes the seed at 1.
- **"pain in childbearing" heard as "pain and childbearing"** in `kokoro/06-male-am_michael.wav` and in the Chatterbox takes of af_heart, af_nicole and bm_fable. This is likely a weak unstressed "in", or a speech-recognition guess. Listen to these.
- **`kokoro/08-male-bm_daniel.wav`:** "childbearing" was transcribed as "child-bearing". This is spelling only, not a speech error.
- Whisper's British spelling "saviour" is normalised to "savior" before comparing, because it is spelling, not speech.

## Watermark and licences

The Perth detector was run with `watermark_check.py`; results are in `watermark.json`. Kokoro takes read {wm_k} and Chatterbox takes read {wm_c}. In an earlier check, the same detector read 1.0 on a plain sine tone, so a 1.0 is not proof on its own. The clean 0.0 on every Kokoro take and 1.0 on every Chatterbox take matches Chatterbox's documented always-on watermark.

- **Kokoro-82M:** Apache-2.0 weights. The `kokoro` and `misaki` packages are also Apache. It adds no watermark.
- **espeak-ng:** GPL-3.0. Kokoro uses it as a phonemiser, and audio you generate with it is not covered by the GPL.
- **Chatterbox:** MIT. An imperceptible Perth watermark is always on. The project README says it has been retired and unmaintained since August 2026.
- **faster-whisper:** MIT. It was only used for checking.
- **Monetized YouTube channel:** both licences allow commercial use of the generated audio, and the voices are Kokoro's built-in synthetic ones, not a real person. Whether a given video is monetised is a separate YouTube Partner Program decision. Check YouTube's current rules on AI or synthetic-content disclosure and on mass-produced or "inauthentic" content before publishing. This is not legal advice.

## Rebuild

Run these from this folder:

- `../../.venv-kokoro/bin/python render_kokoro.py`
- `../../.venv/bin/python render_chatterbox.py`
- `../../.venv-kokoro/bin/python check.py`
- `../../.venv/bin/python watermark_check.py`
- `../../.venv-kokoro/bin/python make_readme.py`

Kokoro and Chatterbox use separate venvs because they pin different numpy versions (2.x and 1.26). The venvs and model caches are not committed.
