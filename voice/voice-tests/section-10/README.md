# Section 10 voice test: Kokoro voices and Chatterbox clones of them

**Nobody has listened to any of this audio.** Everything below comes from measurements and an automatic transcript, not from listening. A person needs to listen before any voice is chosen.

Narration, used exactly as written for every take:

> The serpent was cursed to crawl on its belly. God put hostility between it and the woman, and between their offspring. He will crush your head, and you will strike his heel. Christians have long read this as the first hint of a Savior. The woman would have greatly increased pain in childbearing, and conflict in her marriage. The man would work cursed ground through painful toil, among thorns and thistles, until death. For dust you are and to dust you will return.

- `kokoro/`: Kokoro-82M (package `kokoro` 0.9.4, `misaki` 0.9.4, espeak-ng 1.51), built-in voices only, speed 1.0. Each sentence was rendered separately and the sentences were joined with 0.3 s of silence.
- `references/`: about 12 s of each Kokoro voice reading a neutral, non-scripture text. The cut is made at the quietest point near 12 s, so clips run 10.8-13.0 s.
- `chatterbox-cloned/`: `chatterbox-tts` 0.1.7 with that voice's reference as `audio_prompt_path`, exaggeration 0.3, cfg_weight 0.5, seed 1 set before every sentence. Each sentence was rendered separately and the sentences were joined with 0.3 s of silence.
- Device: CPU, no GPU. Kokoro took 84.1 s for 336.9 s of audio (0.25 s of compute per second of audio). Chatterbox took 21.2 min for 317.4 s of audio (4.01 s of compute per second of audio).

## Results

Speaking rate is the 83 script words divided by the full file length, pauses included. "Non-silent" means more than 30% of 20 ms frames are above -40 dBFS and the peak is above -26 dBFS. Median pitch comes from librosa pYIN over 60-450 Hz. The word check is a faster-whisper `small.en` transcript compared word by word with the script. A flag may be a speech-recognition error rather than a speech error, so listen to flagged takes first.

| File | Gender | Accent | Kokoro grade | Duration (s) | Median pitch (Hz) | Speaking rate (wpm) | Peak (dBFS) | Non-silent | Word check |
|---|---|---|---|---|---|---|---|---|---|
| `kokoro/01-female-af_heart.wav` | female | American | A | 30.9 | 200.7 | 161.2 | -6.2 | yes | OK |
| `kokoro/02-female-bf_emma.wav` | female | British | B- | 31.38 | 182.9 | 158.7 | -5.3 | yes | OK |
| `kokoro/03-female-af_nicole.wav` | female | American | B- | 46.23 | 160.2 | 107.7 | -3.9 | yes | OK |
| `kokoro/04-female-bf_alice.wav` | female | British | D | 32.0 | 221.4 | 155.6 | -4.6 | yes | OK |
| `kokoro/05-female-af_kore.wav` | female | American | C+ | 31.35 | 146.9 | 158.9 | -6.0 | yes | OK |
| `kokoro/06-male-am_michael.wav` | male | American | C+ | 35.23 | 114.6 | 141.4 | -5.9 | yes | FLAG: 'in' -> 'and' |
| `kokoro/07-male-am_fenrir.wav` | male | American | C+ | 30.45 | 136.3 | 163.5 | -1.2 | yes | OK |
| `kokoro/08-male-bm_daniel.wav` | male | British | D | 31.15 | 123.5 | 159.9 | -5.4 | yes | FLAG: 'childbearing' -> 'child bearing' |
| `kokoro/09-male-bm_fable.wav` | male | British | C | 32.98 | 106.9 | 151.0 | -0.6 | yes | OK |
| `kokoro/10-male-bm_lewis.wav` | male | British | D+ | 35.27 | 81.0 | 141.2 | -4.2 | yes | OK |
| `chatterbox-cloned/01-female-af_heart.wav` | female | American | A | 31.56 | 196.1 | 157.8 | -6.1 | yes | FLAG: 'in' -> 'and' |
| `chatterbox-cloned/02-female-bf_emma.wav` | female | British | B- | 30.52 | 182.9 | 163.2 | -3.6 | yes | OK |
| `chatterbox-cloned/03-female-af_nicole.wav` | female | American | B- | 37.04 | 162.0 | 134.4 | -2.0 | yes | FLAG: 'in' -> 'and' |
| `chatterbox-cloned/04-female-bf_alice.wav` | female | British | D | 33.16 | 192.7 | 150.2 | -1.1 | yes | FLAG: 'for' -> 'to no'; 'are' -> 'all' |
| `chatterbox-cloned/05-female-af_kore.wav` | female | American | C+ | 34.68 | 149.5 | 143.6 | -5.5 | yes | OK |
| `chatterbox-cloned/06-male-am_michael.wav` | male | American | C+ | 29.12 | 112.0 | 171.0 | -8.3 | yes | OK |
| `chatterbox-cloned/07-male-am_fenrir.wav` | male | American | C+ | 32.56 | 126.4 | 152.9 | -0.9 | yes | OK |
| `chatterbox-cloned/08-male-bm_daniel.wav` | male | British | D | 27.0 | 117.9 | 184.4 | -5.3 | yes | OK |
| `chatterbox-cloned/09-male-bm_fable.wav` | male | British | C | 29.48 | 114.6 | 168.9 | -10.1 | yes | FLAG: 'in' -> 'and' |
| `chatterbox-cloned/10-male-bm_lewis.wav` | male | British | D+ | 32.32 | 102.1 | 154.1 | -5.2 | yes | OK |
| `references/af_heart.wav` | female | American | A | 12.02 | 199.5 | n/a (reference text) | -7.3 | yes | not transcribed |
| `references/bf_emma.wav` | female | British | B- | 12.24 | 184.0 | n/a (reference text) | -6.2 | yes | not transcribed |
| `references/af_nicole.wav` | female | American | B- | 10.84 | 173.2 | n/a (reference text) | -5.9 | yes | not transcribed |
| `references/bf_alice.wav` | female | British | D | 12.24 | 215.1 | n/a (reference text) | -3.5 | yes | not transcribed |
| `references/af_kore.wav` | female | American | C+ | 12.7 | 149.5 | n/a (reference text) | -6.5 | yes | not transcribed |
| `references/am_michael.wav` | male | American | C+ | 10.94 | 107.5 | n/a (reference text) | -3.8 | yes | not transcribed |
| `references/am_fenrir.wav` | male | American | C+ | 12.72 | 131.6 | n/a (reference text) | -3.0 | yes | not transcribed |
| `references/bm_daniel.wav` | male | British | D | 12.96 | 122.8 | n/a (reference text) | -6.1 | yes | not transcribed |
| `references/bm_fable.wav` | male | British | C | 11.6 | 119.3 | n/a (reference text) | -8.2 | yes | not transcribed |
| `references/bm_lewis.wav` | male | British | D+ | 12.94 | 88.4 | n/a (reference text) | -5.1 | yes | not transcribed |

## Pitch comparison

The rule: if two voices' median pitch is within 1 semitone (about 6%) in both their Kokoro and Chatterbox takes, swap one of them.

| Voice | Kokoro (Hz) | Chatterbox (Hz) | Closest other voice, Kokoro | Closest other voice, Chatterbox |
|---|---|---|---|---|
| af_heart | 200.7 | 196.1 | bf_emma (1.61 st) | bf_alice (0.30 st) |
| bf_emma | 182.9 | 182.9 | af_heart (1.61 st) | bf_alice (0.90 st) |
| af_nicole | 160.2 | 162.0 | af_kore (1.50 st) | af_kore (1.39 st) |
| bf_alice | 221.4 | 192.7 | af_heart (1.70 st) | af_heart (0.30 st) |
| af_kore | 146.9 | 149.5 | am_fenrir (1.30 st) | af_nicole (1.39 st) |
| am_michael | 114.6 | 112.0 | bm_fable (1.20 st) | bm_fable (0.40 st) |
| am_fenrir | 136.3 | 126.4 | af_kore (1.30 st) | bm_daniel (1.21 st) |
| bm_daniel | 123.5 | 117.9 | am_michael (1.29 st) | bm_fable (0.49 st) |
| bm_fable | 106.9 | 114.6 | am_michael (1.20 st) | am_michael (0.40 st) |
| bm_lewis | 81.0 | 102.1 | bm_fable (4.80 st) | am_michael (1.60 st) |

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

The Perth detector was run with `watermark_check.py`; results are in `watermark.json`. Kokoro takes read [0.0] and Chatterbox takes read [1.0]. In an earlier check, the same detector read 1.0 on a plain sine tone, so a 1.0 is not proof on its own. The clean 0.0 on every Kokoro take and 1.0 on every Chatterbox take matches Chatterbox's documented always-on watermark.

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
